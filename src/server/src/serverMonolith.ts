import crypto from "crypto";
import cors from "cors";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { getPool } from "./db";
import { getUsdToIdr } from "./fx/fxService";
import { midtransRequest } from "./midtrans/client";
import { assertAuthSchemaReady } from "./authSchemaGuard";
import { buildAnalyzeJsonSchema, validateAnalyzeJson } from "./llm/analyze/schema";
import { runOpenrouterAnalyze } from "./llm/analyze/openrouterAnalyze";
import { buildStructuredAnalyzeInput } from "./llm/analyze/prompt";
import { recordTokenSpend } from "./llm/freePoolAccounting";
import { type LlmError } from "./llm/llmClient";
import { LLM_LIMITS } from "./llm/limits";
import { getProvider } from "./llm/getProvider";
import { upsertAuditRecord } from "./llm/audit/llmAudit";
import { pickProviderForRequest, type ProviderPolicyMeta } from "./llm/providerRouter";
import { validateChat, validatePaperAnalyze, validatePrefill, type ValidationError } from "./llm/validate";
import { mapModel } from "./llm/models/modelMap";
import { initUsageTracker, type UsageRecord } from "./llm/usage/usageTracker";
import { normalizeUsage, type ProviderUsage } from "./llm/usage/providerUsage";
import { MARKUP_MULTIPLIER, MODEL_PRICE_USD_PER_MTOKEN_COMBINED } from "./pricing/pricingConfig";
import { estimateIdrCost } from "./pricing/pricingCalculator";
import { applyTopupFromMidtrans, chargeForLlm, getBalance } from "./rupiah/rupiahService";

type SessionUser = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

type TokenInfo = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

type AuthContext = {
  id: string;
  google_sub: string;
  email?: string | null;
};

const app = express();
app.set("trust proxy", 1);
const port = Number(process.env.PORT || 8080);

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "arnvoid_session";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const COOKIE_SAMESITE = "lax";
const DEV_PORTS = [5173, 5174, 5175, 5176, 5177, 5178];
const DEFAULT_DEV_ORIGINS = DEV_PORTS.flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`
]);
const DEFAULT_ALLOWED_ORIGINS = ["https://beta.arnvoid.com"];
const SAVED_INTERFACES_LIST_LIMIT = 20;
const MAX_SAVED_INTERFACE_PAYLOAD_BYTES = Number(
  process.env.MAX_SAVED_INTERFACE_PAYLOAD_BYTES || 15 * 1024 * 1024
);
const SAVED_INTERFACE_JSON_LIMIT = process.env.SAVED_INTERFACE_JSON_LIMIT || "15mb";
const PROFILE_DISPLAY_NAME_MAX = 80;
const PROFILE_USERNAME_MAX = 32;
const PROFILE_USERNAME_REGEX = /^[A-Za-z0-9_.-]+$/;
const FEEDBACK_MESSAGE_MAX_CHARS = 8000;
const FEEDBACK_CATEGORY_MAX_CHARS = 64;
const FEEDBACK_CONTEXT_MAX_BYTES = 64 * 1024;
const FEEDBACK_LIST_DEFAULT_LIMIT = 50;
const FEEDBACK_LIST_MAX_LIMIT = 200;
let profileColumnsAvailable = false;
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function readAdminAllowlistRaw(): string {
  const primary = process.env.ADMIN_EMAIL_ALLOWLIST;
  if (typeof primary === "string" && primary.trim().length > 0) {
    return primary;
  }
  const fallback = process.env.ADMIN_EMAILS;
  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback;
  }
  return "";
}

function parseAdminAllowlist(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
  );
}

const ADMIN_EMAIL_ALLOWLIST_SET = parseAdminAllowlist(readAdminAllowlistRaw());

function isAdminUser(auth: AuthContext | undefined | null): boolean {
  if (!auth) return false;
  if (typeof auth.email !== "string") return false;
  const normalized = auth.email.trim().toLowerCase();
  if (!normalized) return false;
  return ADMIN_EMAIL_ALLOWLIST_SET.has(normalized);
}

function sendAdminForbidden(res: express.Response): void {
  res.status(403).json({ error: "forbidden" });
}

// Future feedback admin routes should call this guard before any DB read/update.
function requireFeedbackAdminOrSendForbidden(res: express.Response): AuthContext | null {
  const auth = res.locals.user as AuthContext | undefined;
  if (!isAdminUser(auth)) {
    sendAdminForbidden(res);
    return null;
  }
  return auth ?? null;
}

// Keep a hard reference so root TypeScript build validates this seam before routes land.
const FEEDBACK_ADMIN_GUARD_SEAM = requireFeedbackAdminOrSendForbidden;
void FEEDBACK_ADMIN_GUARD_SEAM;

const savedInterfacesJsonParser = express.json({ limit: SAVED_INTERFACE_JSON_LIMIT });
const globalJsonParser = express.json({ limit: LLM_LIMITS.jsonBodyLimit });
app.use("/api/saved-interfaces", (req, res, next) => savedInterfacesJsonParser(req, res, next));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/saved-interfaces")) {
    next();
    return;
  }
  globalJsonParser(req, res, next);
});
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === "entity.too.large" && req.path.startsWith("/api/saved-interfaces")) {
    res.status(413).json({ ok: false, error: "saved interface payload too large" });
    return;
  }
  next(err);
});

const corsAllowedOrigins =
  allowedOrigins.length > 0
    ? allowedOrigins
    : [...DEFAULT_ALLOWED_ORIGINS, ...DEFAULT_DEV_ORIGINS];
if (isProd() && allowedOrigins.length === 0) {
  console.warn("[cors] ALLOWED_ORIGINS not set in prod; CORS will block real frontend");
}
const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      cb(null, true);
      return;
    }
    if (corsAllowedOrigins.includes(origin)) {
      console.log(`[cors] allowed origin: ${origin}`);
      cb(null, true);
      return;
    }
    console.warn(`[cors] blocked origin: ${origin}`);
    cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

function parseCookies(headerValue?: string) {
  const cookies: Record<string, string> = {};
  if (!headerValue) return cookies;

  const parts = headerValue.split(";");
  for (const part of parts) {
    const [rawName, ...rest] = part.split("=");
    const name = rawName.trim();
    if (!name) continue;
    const value = rest.join("=").trim();
    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

function normalizeSameSite(value: string): "lax" | "none" | "strict" {
  if (value === "none" || value === "lax" || value === "strict") return value;
  return "lax";
}

function isProd() {
  return Boolean(process.env.K_SERVICE) || process.env.NODE_ENV === "production";
}

function isDevBalanceBypassEnabled() {
  return !isProd() && process.env.DEV_BYPASS_BALANCE === "1";
}

async function detectProfileColumnsAvailability(): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.query(
    `select column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = 'users'
        and column_name in ('display_name', 'username')`
  );
  const found = new Set((result.rows || []).map((row: any) => String(row.column_name)));
  return found.has("display_name") && found.has("username");
}

function resolveCookieOptions() {
  const sameSite = normalizeSameSite(COOKIE_SAMESITE);
  const secure = isProd();

  return { sameSite, secure };
}

function clearSessionCookie(res: express.Response) {
  const { sameSite, secure } = resolveCookieOptions();
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/"
  });
}

function parseGrossAmount(value: unknown, fallbackAmount: number): number | null {
  if (value === undefined || value === null) return fallbackAmount;
  const amount = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.trunc(amount);
  if (rounded <= 0) return null;
  return rounded;
}

type FeedbackStatus = "new" | "triaged" | "done";

function normalizeFeedbackCategory(raw: unknown): string | null {
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length > FEEDBACK_CATEGORY_MAX_CHARS) return null;
  return trimmed;
}

function normalizeFeedbackMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > FEEDBACK_MESSAGE_MAX_CHARS) return null;
  return trimmed;
}

function normalizeFeedbackStatus(raw: unknown): FeedbackStatus | null {
  if (raw !== "new" && raw !== "triaged" && raw !== "done") return null;
  return raw;
}

function normalizeFeedbackContext(raw: unknown): { value: Record<string, unknown>; bytes: number } | null {
  if (raw === undefined || raw === null) {
    return { value: {}, bytes: 2 };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  try {
    const serialized = JSON.stringify(raw);
    const bytes = Buffer.byteLength(serialized, "utf8");
    if (bytes > FEEDBACK_CONTEXT_MAX_BYTES) return null;
    return { value: raw as Record<string, unknown>, bytes };
  } catch {
    return null;
  }
}

function parseFeedbackListLimit(raw: unknown): number {
  const num = typeof raw === "string" ? Number(raw) : Number(raw);
  if (!Number.isFinite(num) || !Number.isInteger(num)) return FEEDBACK_LIST_DEFAULT_LIMIT;
  return Math.min(FEEDBACK_LIST_MAX_LIMIT, Math.max(1, num));
}

function parseFeedbackBeforeId(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const num = typeof raw === "string" ? Number(raw) : Number(raw);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) return null;
  return num;
}

type ApiErrorCode =
  | "bad_request"
  | "too_large"
  | "unauthorized"
  | "insufficient_rupiah"
  | "rate_limited"
  | "upstream_error"
  | "timeout"
  | "parse_error"
  | "structured_output_invalid";

type ApiError = {
  ok: false;
  request_id: string;
  code: ApiErrorCode;
  error: string;
};

const llmConcurrency = new Map<string, number>();
const MAX_CONCURRENT_LLM = 2;
let llmRequestsTotal = 0;
let llmRequestsInflight = 0;
let llmRequestsStreaming = 0;

function getUserId(user: AuthContext): string {
  return String(user.id);
}

function acquireLlmSlot(userId: string): boolean {
  const current = llmConcurrency.get(userId) || 0;
  if (current >= MAX_CONCURRENT_LLM) return false;
  llmConcurrency.set(userId, current + 1);
  return true;
}

function releaseLlmSlot(userId: string) {
  const current = llmConcurrency.get(userId) || 0;
  const next = current - 1;
  if (next <= 0) llmConcurrency.delete(userId);
  else llmConcurrency.set(userId, next);
}

function sendApiError(res: express.Response, status: number, body: ApiError) {
  res.setHeader("X-Request-Id", body.request_id);
  res.status(status).json(body);
}

function isValidationError(value: unknown): value is ValidationError {
  return Boolean(value) && typeof value === "object" && (value as ValidationError).ok === false;
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function logLlmRequest(fields: {
  request_id: string;
  endpoint: string;
  user_id: string;
  model: string;
  input_chars: number;
  output_chars: number;
  duration_ms: number;
  time_to_first_token_ms?: number | null;
  status_code: number;
  termination_reason: string;
  rupiah_cost?: number | null;
  rupiah_balance_before?: number | null;
  rupiah_balance_after?: number | null;
  provider?: "openai" | "openrouter" | null;
  provider_model_id?: string | null;
  structured_output_mode?: string | null;
  validation_result?: string | null;
  usage_input_tokens?: number | null;
  usage_output_tokens?: number | null;
  usage_total_tokens?: number | null;
  usage_source?: string | null;
  provider_usage_present?: boolean | null;
  provider_usage_source?: string | null;
  provider_usage_fields_present?: string[] | null;
  tokenizer_encoding_used?: string | null;
  tokenizer_fallback_reason?: string | null;
  freepool_decrement_tokens?: number | null;
  freepool_decrement_applied?: boolean | null;
  freepool_decrement_reason?: string | null;
}) {
  console.log(JSON.stringify({
    request_id: fields.request_id,
    endpoint: fields.endpoint,
    user_id: fields.user_id,
    model: fields.model,
    provider: fields.provider ?? null,
    provider_model_id: fields.provider_model_id ?? null,
    input_chars: fields.input_chars,
    output_chars: fields.output_chars,
    duration_ms: fields.duration_ms,
    time_to_first_token_ms: fields.time_to_first_token_ms ?? null,
    status_code: fields.status_code,
    termination_reason: fields.termination_reason,
    usage_input_tokens: fields.usage_input_tokens ?? null,
    usage_output_tokens: fields.usage_output_tokens ?? null,
    usage_total_tokens: fields.usage_total_tokens ?? null,
    usage_source: fields.usage_source ?? null,
    provider_usage_present: fields.provider_usage_present ?? null,
    provider_usage_source: fields.provider_usage_source ?? null,
    provider_usage_fields_present: fields.provider_usage_fields_present ?? null,
    tokenizer_encoding_used: fields.tokenizer_encoding_used ?? null,
    tokenizer_fallback_reason: fields.tokenizer_fallback_reason ?? null,
    rupiah_cost: fields.rupiah_cost ?? null,
    rupiah_balance_before: fields.rupiah_balance_before ?? null,
    rupiah_balance_after: fields.rupiah_balance_after ?? null,
    freepool_decrement_tokens: fields.freepool_decrement_tokens ?? null,
    freepool_decrement_applied: fields.freepool_decrement_applied ?? null,
    freepool_decrement_reason: fields.freepool_decrement_reason ?? null,
    structured_output_mode: fields.structured_output_mode ?? null,
    validation_result: fields.validation_result ?? null
  }));
}

function mapLlmErrorToStatus(error: LlmError): number {
  switch (error.code) {
    case "bad_request":
      return 400;
    case "rate_limited":
      return 429;
    case "timeout":
      return 504;
    case "parse_error":
      return 502;
    case "unauthorized":
      return 401;
    default:
      return 502;
  }
}

function mapTerminationReason(statusCode: number, code?: string) {
  if (statusCode === 402 || code === "insufficient_rupiah") return "insufficient_rupiah";
  if (statusCode === 429) return "rate_limited";
  if (statusCode === 400 || statusCode === 413) return "validation_error";
  if (statusCode === 504 || code === "timeout") return "timeout";
  if (code === "structured_output_invalid") return "structured_output_invalid";
  if (code === "upstream_error" || statusCode >= 500) return "upstream_error";
  if (statusCode === 200) return "success";
  return "upstream_error";
}

const ALLOW_OPENROUTER_ANALYZE = process.env.ALLOW_OPENROUTER_ANALYZE === "true";
const OPENROUTER_ANALYZE_MODELS = new Set(
  (process.env.OPENROUTER_ANALYZE_MODELS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

function isOpenrouterAnalyzeAllowed(model: string): boolean {
  if (!ALLOW_OPENROUTER_ANALYZE) return false;
  if (OPENROUTER_ANALYZE_MODELS.size === 0) return false;
  return OPENROUTER_ANALYZE_MODELS.has(model);
}

function getUsageFieldList(usage: ProviderUsage | null | undefined): string[] {
  const fields: string[] = [];
  if (!usage) return fields;
  if (usage.input_tokens !== undefined) fields.push("input");
  if (usage.output_tokens !== undefined) fields.push("output");
  if (usage.total_tokens !== undefined) fields.push("total");
  return fields;
}

function getPriceUsdPerM(model: string): number | null {
  const value = MODEL_PRICE_USD_PER_MTOKEN_COMBINED[model];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}


setInterval(() => {
  console.log(JSON.stringify({
    llm_requests_total: llmRequestsTotal,
    llm_requests_inflight: llmRequestsInflight,
    llm_requests_streaming: llmRequestsStreaming
  }));
}, 60000);

function sanitizeActions(value: unknown): Array<{ name: string; method: string; url: string }> {
  if (!Array.isArray(value)) return [];
  const out: Array<{ name: string; method: string; url: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as { name?: unknown }).name || "").trim();
    const method = String((item as { method?: unknown }).method || "").trim();
    const url = String((item as { url?: unknown }).url || "").trim();
    if (name && method && url) out.push({ name, method, url });
  }
  return out;
}

function isPaidStatus(status: string | undefined): boolean {
  return status === "settlement" || status === "capture";
}

function verifyMidtransSignature(body: any): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return false;
  const orderId = String(body?.order_id || "");
  const statusCode = String(body?.status_code || "");
  const grossAmount = String(body?.gross_amount || "");
  const signatureKey = String(body?.signature_key || "");
  if (!orderId || !statusCode || !grossAmount || !signatureKey) return false;

  const expected = crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");

  return expected === signatureKey;
}

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  if (!sessionId) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.query(
      `select users.id as id, users.google_sub as google_sub, users.email as email
       from sessions
       join users on users.id = sessions.user_id
       where sessions.id = $1 and sessions.expires_at > now()`,
      [sessionId]
    );
    const row = result.rows[0] as AuthContext | undefined;
    if (!row) {
      clearSessionCookie(res);
      res.status(401).json({ ok: false, error: "invalid session" });
      return;
    }
    res.locals.user = row;
    next();
  } catch (e) {
    res.status(500).json({ ok: false, error: `db error: ${String(e)}` });
  }
}

app.post("/api/payments/webhook", async (req, res) => {
  const body = req.body ?? {};
  const now = new Date();
  const eventId = crypto.randomUUID();
  const orderId = body?.order_id ? String(body.order_id) : null;
  const transactionId = body?.transaction_id ? String(body.transaction_id) : null;
  const signatureKey = body?.signature_key ? String(body.signature_key) : null;
  const verified = verifyMidtransSignature(body);

  try {
    const pool = await getPool();
    await pool.query(
      `insert into payment_webhook_events
        (id, received_at, order_id, midtrans_transaction_id, raw_body, signature_key, is_verified, processed)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [eventId, now, orderId, transactionId, body, signatureKey, verified, false]
    );
  } catch (e) {
    res.status(200).json({ ok: false, error: "failed to store webhook" });
    return;
  }

  let processingError: string | null = null;
  let rupiahApplyError: string | null = null;
  let shouldApplyCredits = false;
  if (verified && orderId) {
    try {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const status = body?.transaction_status ? String(body.transaction_status) : "unknown";
        const paidAt = isPaidStatus(status) ? now : null;
        const updateResult = await client.query(
          `update payment_transactions
             set status = $2,
                 midtrans_transaction_id = coalesce($3, midtrans_transaction_id),
                 midtrans_response_json = $4,
                 updated_at = $5,
                 paid_at = case
                   when paid_at is null and $6 is not null then $6
                   else paid_at
                 end
           where order_id = $1`,
          [orderId, status, transactionId, body, now, paidAt]
        );
        if (updateResult.rowCount === 0) {
          processingError = "order not found";
        }
        if (paidAt) {
          shouldApplyCredits = true;
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        processingError = "failed to update transaction";
      } finally {
        client.release();
      }
    } catch (e) {
      processingError = "failed to update transaction";
    }
  } else if (!verified) {
    processingError = "signature not verified";
  }

  if (!processingError && shouldApplyCredits && orderId) {
    try {
      const pool = await getPool();
      const result = await pool.query(
        `select user_id, gross_amount
           from payment_transactions
          where order_id = $1`,
        [orderId]
      );
      const row = result.rows[0];
      if (row) {
        await applyTopupFromMidtrans({
          userId: String(row.user_id),
          orderId,
          amountIdr: Number(row.gross_amount || 0)
        });
      } else {
        rupiahApplyError = "rupiah apply failed: missing transaction row";
      }
    } catch (e) {
      rupiahApplyError = "rupiah apply failed";
    }
  }

  if (!processingError && rupiahApplyError) {
    processingError = rupiahApplyError;
  }

  try {
    const pool = await getPool();
    await pool.query(
      `update payment_webhook_events
         set processed = $2, processing_error = $3
       where id = $1`,
      [eventId, true, processingError]
    );
  } catch (e) {
    res.status(200).json({ ok: false, error: "failed to finalize webhook" });
    return;
  }

  res.status(200).json({ ok: true });
});

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.get("/health", async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post("/auth/google", async (req, res) => {
  const idToken = req.body?.idToken;
  if (!idToken) {
    res.status(400).json({ ok: false, error: "missing idToken" });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ ok: false, error: "GOOGLE_CLIENT_ID is not set" });
    return;
  }

  console.log("[auth] requiredAudience:", process.env.GOOGLE_CLIENT_ID);

  let tokenInfo: TokenInfo | null = null;
  try {
    const oauthClient = new OAuth2Client(clientId);
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: clientId
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      res.status(401).json({ ok: false, error: "token missing subject" });
      return;
    }

    tokenInfo = {
      sub: payload.sub,
      email: payload.email ?? undefined,
      name: payload.name ?? undefined,
      picture: payload.picture ?? undefined
    };
  } catch (e) {
    res.status(401).json({ ok: false, error: `token validation failed: ${String(e)}` });
    return;
  }

  if (!tokenInfo?.sub) {
    res.status(401).json({ ok: false, error: "token missing subject" });
    return;
  }

  const user: SessionUser = {
    sub: tokenInfo.sub,
    email: tokenInfo.email,
    name: tokenInfo.name,
    picture: tokenInfo.picture
  };

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  let userRow: {
    id: string;
    google_sub: string;
    email: string | null;
    name: string | null;
    picture: string | null;
    display_name: string | null;
    username: string | null;
  } | null = null;

  try {
    const pool = await getPool();
    const upsertSql = profileColumnsAvailable
      ? `insert into users (google_sub, email, name, picture)
         values ($1, $2, $3, $4)
         on conflict (google_sub)
         do update set email = excluded.email, name = excluded.name, picture = excluded.picture
         returning id, google_sub, email, name, picture, display_name, username`
      : `insert into users (google_sub, email, name, picture)
         values ($1, $2, $3, $4)
         on conflict (google_sub)
         do update set email = excluded.email, name = excluded.name, picture = excluded.picture
         returning id, google_sub, email, name, picture`;
    const upsertResult = await pool.query(upsertSql, [
      user.sub,
      user.email ?? null,
      user.name ?? null,
      user.picture ?? null
    ]);
    userRow = upsertResult.rows[0] || null;

    if (!userRow) {
      res.status(500).json({ ok: false, error: "failed to upsert user" });
      return;
    }

    await pool.query(
      `insert into sessions (id, user_id, expires_at)
       values ($1, $2, $3)`,
      [sessionId, userRow.id, expiresAt]
    );
  } catch (e) {
    res.status(500).json({ ok: false, error: `db error: ${String(e)}` });
    return;
  }

  const { sameSite, secure } = resolveCookieOptions();

  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: SESSION_TTL_MS
  });

  res.json({
    ok: true,
    user: {
      sub: userRow.google_sub,
      email: userRow.email ?? undefined,
      name: userRow.name ?? undefined,
      picture: userRow.picture ?? undefined,
      displayName: profileColumnsAvailable ? userRow.display_name ?? undefined : undefined,
      username: profileColumnsAvailable ? userRow.username ?? undefined : undefined
    }
  });
});

app.get("/me", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  if (!sessionId) {
    res.json({ ok: true, user: null });
    return;
  }

  try {
    const pool = await getPool();
    const meSql = profileColumnsAvailable
      ? `select sessions.expires_at as expires_at,
                users.google_sub as google_sub,
                users.email as email,
                users.name as name,
                users.picture as picture,
                users.display_name as display_name,
                users.username as username
           from sessions
           join users on users.id = sessions.user_id
          where sessions.id = $1`
      : `select sessions.expires_at as expires_at,
                users.google_sub as google_sub,
                users.email as email,
                users.name as name,
                users.picture as picture
           from sessions
           join users on users.id = sessions.user_id
          where sessions.id = $1`;
    const result = await pool.query(meSql, [sessionId]);

    const row = result.rows[0];
    if (!row) {
      clearSessionCookie(res);
      console.log("[auth] session missing -> cleared cookie");
      res.json({ ok: true, user: null });
      return;
    }

    const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
    if (expiresAt && Date.now() > expiresAt.getTime()) {
      await pool.query("delete from sessions where id = $1", [sessionId]);
      clearSessionCookie(res);
      console.log("[auth] session expired -> cleared cookie");
      res.json({ ok: true, user: null });
      return;
    }

    res.json({
      ok: true,
      user: {
        sub: row.google_sub,
        email: row.email ?? undefined,
        name: row.name ?? undefined,
        picture: row.picture ?? undefined,
        displayName: profileColumnsAvailable ? row.display_name ?? undefined : undefined,
        username: profileColumnsAvailable ? row.username ?? undefined : undefined
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: `db error: ${String(e)}` });
  }
});

app.post("/auth/logout", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  if (sessionId) {
    try {
      const pool = await getPool();
      await pool.query("delete from sessions where id = $1", [sessionId]);
    } catch (e) {
      res.status(500).json({ ok: false, error: `db error: ${String(e)}` });
      return;
    }
  }

  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post("/api/profile/update", requireAuth, async (req, res) => {
  if (!profileColumnsAvailable) {
    res.status(503).json({ ok: false, error: "profile schema not ready; apply migration first" });
    return;
  }
  const user = res.locals.user as AuthContext;
  const displayNameRaw = req.body?.displayName;
  const usernameRaw = req.body?.username;

  if (typeof displayNameRaw !== "string" || typeof usernameRaw !== "string") {
    res.status(400).json({ ok: false, error: "displayName and username are required" });
    return;
  }

  const displayNameTrimmed = displayNameRaw.replace(/\s+/g, " ").trim();
  if (displayNameTrimmed.length > PROFILE_DISPLAY_NAME_MAX) {
    res.status(400).json({
      ok: false,
      error: `displayName max length is ${PROFILE_DISPLAY_NAME_MAX}`
    });
    return;
  }
  const displayName = displayNameTrimmed.length > 0 ? displayNameTrimmed : null;

  const usernameTrimmed = usernameRaw.trim();
  if (usernameTrimmed.length > PROFILE_USERNAME_MAX) {
    res.status(400).json({
      ok: false,
      error: `username max length is ${PROFILE_USERNAME_MAX}`
    });
    return;
  }
  if (usernameTrimmed.length > 0 && !PROFILE_USERNAME_REGEX.test(usernameTrimmed)) {
    res.status(400).json({
      ok: false,
      error: "username may only contain letters, numbers, dot, underscore, and dash"
    });
    return;
  }
  const username = usernameTrimmed.length > 0 ? usernameTrimmed : null;

  try {
    const pool = await getPool();
    const result = await pool.query(
      `update users
          set display_name = $2,
              username = $3
        where id = $1
      returning google_sub, email, name, picture, display_name, username`,
      [user.id, displayName, username]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ ok: false, error: "user not found" });
      return;
    }
    res.json({
      ok: true,
      user: {
        sub: row.google_sub,
        email: row.email ?? undefined,
        name: row.name ?? undefined,
        picture: row.picture ?? undefined,
        displayName: row.display_name ?? undefined,
        username: row.username ?? undefined
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: "failed to update profile" });
  }
});

app.post("/api/feedback", requireAuth, async (req, res) => {
  const user = res.locals.user as AuthContext;
  const category = normalizeFeedbackCategory(req.body?.category);
  const message = normalizeFeedbackMessage(req.body?.message);
  const context = normalizeFeedbackContext(req.body?.context);

  if (category === null) {
    res.status(400).json({ ok: false, error: `category max length is ${FEEDBACK_CATEGORY_MAX_CHARS}` });
    return;
  }
  if (message === null) {
    res.status(400).json({ ok: false, error: `message is required and max length is ${FEEDBACK_MESSAGE_MAX_CHARS}` });
    return;
  }
  if (context === null) {
    res.status(400).json({ ok: false, error: "context must be an object and within size limit" });
    return;
  }

  try {
    const pool = await getPool();
    const serializedContext = JSON.stringify(context.value);
    const result = await pool.query(
      `insert into feedback_messages (user_id, category, message, context_json, status)
       values ($1, $2, $3, $4::jsonb, 'new')
       returning id`,
      [user.id, category, message, serializedContext]
    );
    const id = Number(result.rows[0]?.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(500).json({ ok: false, error: "failed to submit feedback" });
      return;
    }
    console.log(
      "[feedback] submit ok user=%s id=%s cat=%s len=%s ctxBytes=%s",
      user.id,
      id,
      category,
      message.length,
      context.bytes
    );
    res.json({ ok: true, id });
  } catch {
    res.status(500).json({ ok: false, error: "failed to submit feedback" });
  }
});

app.get("/api/feedback", requireAuth, async (req, res) => {
  const admin = requireFeedbackAdminOrSendForbidden(res);
  if (!admin) return;

  const limit = parseFeedbackListLimit(req.query?.limit);
  const beforeIdRaw = req.query?.beforeId;
  const beforeId = parseFeedbackBeforeId(beforeIdRaw);
  if (beforeId === null && beforeIdRaw !== undefined && beforeIdRaw !== null && beforeIdRaw !== "") {
    res.status(400).json({ ok: false, error: "beforeId must be a positive integer" });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.query(
      `select id, user_id, category, message, context_json, status, created_at
         from feedback_messages
        where ($2::bigint is null or id < $2)
        order by id desc
        limit $1`,
      [limit, beforeId]
    );

    const items = result.rows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.user_id),
      category: String(row.category ?? ""),
      message: String(row.message ?? ""),
      context: row.context_json ?? {},
      status: String(row.status ?? "new"),
      createdAt: toIsoString(row.created_at),
    }));
    const nextCursor = items.length === limit ? items[items.length - 1]?.id : undefined;

    console.log("[feedback] admin_list ok n=%s beforeId=%s", items.length, beforeId ?? "null");
    res.json({
      ok: true,
      items,
      ...(typeof nextCursor === "number" ? { nextCursor } : {}),
    });
  } catch {
    res.status(500).json({ ok: false, error: "failed to list feedback" });
  }
});

app.post("/api/feedback/update-status", requireAuth, async (req, res) => {
  const admin = requireFeedbackAdminOrSendForbidden(res);
  if (!admin) return;

  const idRaw = req.body?.id;
  const id = typeof idRaw === "string" ? Number(idRaw) : Number(idRaw);
  if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "id must be a positive integer" });
    return;
  }
  const status = normalizeFeedbackStatus(req.body?.status);
  if (!status) {
    res.status(400).json({ ok: false, error: "status must be one of new, triaged, done" });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.query(
      `update feedback_messages
          set status = $2
        where id = $1`,
      [id, status]
    );
    const updated = (result.rowCount || 0) === 1;
    console.log("[feedback] admin_status ok id=%s status=%s updated=%s", id, status, updated);
    res.json({ ok: true, updated });
  } catch {
    res.status(500).json({ ok: false, error: "failed to update feedback status" });
  }
});

app.get("/api/saved-interfaces", requireAuth, async (_req, res) => {
  const user = res.locals.user as AuthContext;
  try {
    const pool = await getPool();
    const result = await pool.query(
      `select client_interface_id, title, payload_version, payload_json, created_at, updated_at
         from saved_interfaces
        where user_id = $1
        order by updated_at desc
        limit $2`,
      [user.id, SAVED_INTERFACES_LIST_LIMIT]
    );
    const items = result.rows.map((row) => ({
      client_interface_id: String(row.client_interface_id),
      title: String(row.title),
      payload_version: Number(row.payload_version),
      payload_json: row.payload_json,
      created_at: toIsoString(row.created_at),
      updated_at: toIsoString(row.updated_at),
    }));
    console.log(`[saved-interfaces] list user_id=${user.id} count=${items.length}`);
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: "failed to load saved interfaces" });
  }
});

app.post("/api/saved-interfaces/upsert", requireAuth, async (req, res) => {
  const user = res.locals.user as AuthContext;
  const clientInterfaceIdRaw = req.body?.clientInterfaceId;
  const titleRaw = req.body?.title;
  const payloadVersionRaw = req.body?.payloadVersion;
  const payloadJson = req.body?.payloadJson;

  const clientInterfaceId = typeof clientInterfaceIdRaw === "string" ? clientInterfaceIdRaw.trim() : "";
  const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
  const payloadVersion = Number(payloadVersionRaw);

  if (!clientInterfaceId) {
    res.status(400).json({ ok: false, error: "clientInterfaceId is required" });
    return;
  }
  if (!title) {
    res.status(400).json({ ok: false, error: "title is required" });
    return;
  }
  if (!Number.isFinite(payloadVersion) || !Number.isInteger(payloadVersion) || payloadVersion < 1) {
    res.status(400).json({ ok: false, error: "payloadVersion must be a positive integer" });
    return;
  }
  if (payloadJson === null || payloadJson === undefined || typeof payloadJson !== "object") {
    res.status(400).json({ ok: false, error: "payloadJson must be an object" });
    return;
  }

  let payloadBytes = 0;
  try {
    payloadBytes = Buffer.byteLength(JSON.stringify(payloadJson), "utf8");
  } catch {
    res.status(400).json({ ok: false, error: "payloadJson is not serializable" });
    return;
  }

  if (payloadBytes > MAX_SAVED_INTERFACE_PAYLOAD_BYTES) {
    res.status(413).json({ ok: false, error: "saved interface payload too large" });
    return;
  }

  try {
    const pool = await getPool();
    await pool.query(
      `insert into saved_interfaces
        (user_id, client_interface_id, title, payload_version, payload_json)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, client_interface_id)
       do update set
         title = excluded.title,
         payload_version = excluded.payload_version,
         payload_json = excluded.payload_json,
         updated_at = now()`,
      [user.id, clientInterfaceId, title, payloadVersion, payloadJson]
    );
    console.log(
      `[saved-interfaces] upsert user_id=${user.id} client_interface_id=${clientInterfaceId} payload_bytes=${payloadBytes}`
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "failed to upsert saved interface" });
  }
});

app.post("/api/saved-interfaces/delete", requireAuth, async (req, res) => {
  const user = res.locals.user as AuthContext;
  const clientInterfaceIdRaw = req.body?.clientInterfaceId;
  const clientInterfaceId = typeof clientInterfaceIdRaw === "string" ? clientInterfaceIdRaw.trim() : "";
  if (!clientInterfaceId) {
    res.status(400).json({ ok: false, error: "clientInterfaceId is required" });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.query(
      `delete from saved_interfaces
        where user_id = $1 and client_interface_id = $2`,
      [user.id, clientInterfaceId]
    );
    const deleted = (result.rowCount || 0) > 0;
    console.log(
      `[saved-interfaces] delete user_id=${user.id} client_interface_id=${clientInterfaceId} deleted=${deleted}`
    );
    res.json({ ok: true, deleted });
  } catch (e) {
    res.status(500).json({ ok: false, error: "failed to delete saved interface" });
  }
});

app.get("/api/rupiah/me", requireAuth, async (_req, res) => {
  const user = res.locals.user as AuthContext;
  try {
    const balance = await getBalance(String(user.id));
    res.json({ ok: true, balance_idr: balance.balance_idr, updated_at: balance.updated_at });
  } catch (e) {
    res.status(500).json({ ok: false, error: "failed to load rupiah balance" });
  }
});

app.post("/api/payments/gopayqris/create", requireAuth, async (req, res) => {
  const user = res.locals.user as AuthContext;
  const grossAmount = parseGrossAmount(req.body?.gross_amount, 1000);
  if (!grossAmount) {
    res.status(400).json({ ok: false, error: "invalid gross_amount" });
    return;
  }

  const orderId = `arnv-${user.id}-${Date.now()}`;
  const now = new Date();
  const rowId = crypto.randomUUID();

  try {
    const pool = await getPool();
    await pool.query(
      `insert into payment_transactions
        (id, user_id, order_id, gross_amount, payment_type, status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [rowId, user.id, orderId, grossAmount, "gopay", "created", now, now]
    );
  } catch (e) {
    res.status(500).json({ ok: false, error: "failed to create transaction" });
    return;
  }

  const chargePayload = {
    payment_type: "gopay",
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount
    },
    gopay: {
      enable_callback: true,
      callback_url: "https://<your-domain>/payment/gopay-finish"
    }
  };

  const midtransResult = await midtransRequest("/v2/charge", {
    method: "POST",
    body: chargePayload
  });

  if (midtransResult.ok === false) {
    try {
      const pool = await getPool();
      await pool.query(
        `update payment_transactions
            set status = $2,
                midtrans_response_json = $3,
                updated_at = $4
          where order_id = $1`,
        [orderId, "failed", midtransResult.error, new Date()]
      );
    } catch {
      // Ignore update failure here.
    }

    res.status(502).json({ ok: false, error: midtransResult.error, order_id: orderId });
    return;
  }

  const data = midtransResult.data as {
    transaction_id?: string;
    transaction_status?: string;
    payment_type?: string;
    actions?: unknown;
  };

  const transactionId = data.transaction_id || null;
  const transactionStatus = data.transaction_status || "pending";
  const paymentType = data.payment_type || "gopay";
  const actions = sanitizeActions(data.actions);

  try {
    const pool = await getPool();
    await pool.query(
      `update payment_transactions
          set status = $2,
              midtrans_transaction_id = $3,
              midtrans_response_json = $4,
              updated_at = $5
        where order_id = $1`,
      [orderId, transactionStatus, transactionId, midtransResult.data, new Date()]
    );
  } catch (e) {
    res.status(500).json({ ok: false, error: "failed to store transaction" });
    return;
  }

  res.json({
    ok: true,
    order_id: orderId,
    transaction_id: transactionId,
    payment_type: paymentType,
    transaction_status: transactionStatus,
    actions
  });
});

app.post("/api/llm/paper-analyze", requireAuth, async (req, res) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  llmRequestsTotal += 1;
  llmRequestsInflight += 1;
  const user = res.locals.user as AuthContext;
  const userId = getUserId(user);
  let rupiahCost: number | null = null;
  let rupiahBefore: number | null = null;
  let rupiahAfter: number | null = null;
  let fxRate = 0;
  let providerName: "openai" | "openrouter" | null = null;
  let providerModelId = "";
  let usageRecord: UsageRecord | null = null;
  let freepoolDecrement: number | null = null;
  let freepoolApplied: boolean | null = null;
  let freepoolReason: string | null = null;
  let providerUsage: ProviderUsage | null = null;
  let auditWritten = false;
  let auditSelectedProvider = "unknown";
  let auditActualProvider = "unknown";
  let auditLogicalModel = typeof req.body?.model === "string" ? req.body.model : "unknown";
  let auditProviderModelId = "unknown";
  let auditUsageSource = "estimate_wordcount";
  let auditInputTokens = 0;
  let auditOutputTokens = 0;
  let auditTotalTokens = 0;
  let auditTokenizerEncoding: string | null = null;
  let auditTokenizerFallback: string | null = null;
  let auditProviderUsagePresent = false;
  let auditFxRate: number | null = null;
  let auditPriceUsdPerM = getPriceUsdPerM(auditLogicalModel);
  let auditCostIdr = 0;
  let auditBalanceBefore: number | null = null;
  let auditBalanceAfter: number | null = null;
  let auditChargeStatus = "unknown";
  let auditChargeError: string | null = null;
  let auditFreepoolApplied = false;
  let auditFreepoolDecrement = 0;
  let auditFreepoolReason: string | null = null;
  let auditHttpStatus: number | null = null;
  let auditTerminationReason: string | null = null;

  async function writeAudit() {
    if (auditWritten) return;
    auditWritten = true;
    try {
      await upsertAuditRecord({
        request_id: requestId,
        user_id: userId,
        endpoint_kind: "paper-analyze",
        selected_provider: auditSelectedProvider,
        actual_provider_used: auditActualProvider,
        logical_model: auditLogicalModel,
        provider_model_id: auditProviderModelId,
        usage_source: auditUsageSource,
        input_tokens: auditInputTokens,
        output_tokens: auditOutputTokens,
        total_tokens: auditTotalTokens,
        tokenizer_encoding_used: auditTokenizerEncoding,
        tokenizer_fallback_reason: auditTokenizerFallback,
        provider_usage_present: auditProviderUsagePresent,
        fx_usd_idr: auditFxRate,
        price_usd_per_mtoken: auditPriceUsdPerM,
        markup_multiplier: MARKUP_MULTIPLIER,
        cost_idr: auditCostIdr,
        balance_before_idr: auditBalanceBefore,
        balance_after_idr: auditBalanceAfter,
        charge_status: auditChargeStatus,
        charge_error_code: auditChargeError,
        freepool_applied: auditFreepoolApplied,
        freepool_decrement_tokens: auditFreepoolDecrement,
        freepool_reason: auditFreepoolReason,
        http_status: auditHttpStatus,
        termination_reason: auditTerminationReason
      });
    } catch {
      // Ignore audit write failures.
    }
  }

  const validationResult = validatePaperAnalyze(req.body);
  if (isValidationError(validationResult)) {
    auditHttpStatus = validationResult.status;
    auditTerminationReason = "validation_error";
    auditChargeStatus = "skipped";
    await writeAudit();
    sendApiError(res, validationResult.status, {
      ok: false,
      request_id: requestId,
      code: validationResult.code,
      error: validationResult.error
    });
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/paper-analyze",
      user_id: userId,
      model: req.body?.model || "unknown",
      input_chars: typeof req.body?.text === "string" ? req.body.text.length : 0,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: validationResult.status,
      termination_reason: "validation_error",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    llmRequestsInflight -= 1;
    return;
  }
  const validation = validationResult;

  if (!acquireLlmSlot(userId)) {
    auditHttpStatus = 429;
    auditTerminationReason = "rate_limited";
    auditChargeStatus = "skipped";
    await writeAudit();
    sendApiError(res, 429, {
      ok: false,
      request_id: requestId,
      code: "rate_limited",
      error: "too many concurrent requests"
    });
    res.setHeader("Retry-After", "5");
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/paper-analyze",
      user_id: userId,
      model: validation.model,
      input_chars: validation.text.length,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: 429,
      termination_reason: "rate_limited",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    llmRequestsInflight -= 1;
    return;
  }

  try {
    auditLogicalModel = validation.model;
    auditPriceUsdPerM = getPriceUsdPerM(validation.model);
    const router = await pickProviderForRequest({ userId, endpointKind: "analyze" });
    let provider = router.provider;
    let structuredOutputMode = provider.name === "openai" ? "openai_native" : "openrouter_prompt_json";
    let forcedProvider = false;

    if (provider.name === "openrouter" && !isOpenrouterAnalyzeAllowed(validation.model)) {
      provider = getProvider("openai");
      structuredOutputMode = "forced_openai";
      forcedProvider = true;
    }

    providerName = provider.name;
    auditSelectedProvider = router.selectedProviderName;
    auditActualProvider = provider.name;
    providerModelId = mapModel(provider.name, validation.model);
    auditProviderModelId = providerModelId;
    console.log(`[llm] provider_policy selected=${router.selectedProviderName} actual_provider=${provider.name} logical_model=${validation.model} provider_model_id=${providerModelId} cohort=${router.policyMeta.cohort_selected} used_tokens=${router.policyMeta.user_used_tokens_today} pool_remaining=${router.policyMeta.pool_remaining_tokens} cap=${router.policyMeta.user_free_cap} reason=${router.policyMeta.reason} date_key=${router.policyMeta.date_key}`);
    if (forcedProvider) {
      console.log("[llm] analyze forced_provider=openai reason=analyze_requires_strict_json");
    }

    const analyzeInput = buildStructuredAnalyzeInput({
      text: validation.text,
      nodeCount: validation.nodeCount,
      lang: validation.lang
    });
    const usageTracker = initUsageTracker({
      provider: provider.name,
      logical_model: validation.model,
      provider_model_id: providerModelId,
      request_id: requestId
    });
    usageTracker.recordInputText(analyzeInput);
    const inputTokensEstimate = usageTracker.getInputTokensEstimate();
    const fx = await getUsdToIdr();
    fxRate = fx.rate;
    auditFxRate = fxRate;
    const estimated = estimateIdrCost({
      model: validation.model,
      inputTokens: inputTokensEstimate,
      outputTokens: 0,
      fxRate
    });
    const bypassBalance = isDevBalanceBypassEnabled();
    if (!bypassBalance) {
      const balanceSnapshot = await getBalance(userId);
      if (balanceSnapshot.balance_idr < estimated.idrCostRounded) {
        const shortfall = estimated.idrCostRounded - balanceSnapshot.balance_idr;
        auditInputTokens = inputTokensEstimate;
        auditOutputTokens = 0;
        auditTotalTokens = inputTokensEstimate;
        auditUsageSource = "estimate_wordcount";
        auditProviderUsagePresent = false;
        auditCostIdr = 0;
        auditBalanceBefore = balanceSnapshot.balance_idr;
        auditBalanceAfter = balanceSnapshot.balance_idr;
        auditChargeStatus = "failed";
        auditChargeError = "insufficient_rupiah";
        auditHttpStatus = 402;
        auditTerminationReason = "insufficient_rupiah";
        await writeAudit();
        res.setHeader("X-Request-Id", requestId);
        res.setHeader("X-Request-Id", requestId);
        res.setHeader("X-Request-Id", requestId);
        res.status(402).json({
          ok: false,
          code: "insufficient_rupiah",
          request_id: requestId,
          needed_idr: estimated.idrCostRounded,
          balance_idr: balanceSnapshot.balance_idr,
          shortfall_idr: shortfall
        });
        logLlmRequest({
          request_id: requestId,
          endpoint: "/api/llm/paper-analyze",
          user_id: userId,
          model: validation.model,
          provider_model_id: providerModelId,
          input_chars: validation.text.length,
          output_chars: 0,
          duration_ms: Date.now() - startedAt,
          status_code: 402,
          termination_reason: "insufficient_rupiah",
          rupiah_cost: estimated.idrCostRounded,
          rupiah_balance_before: balanceSnapshot.balance_idr,
          rupiah_balance_after: balanceSnapshot.balance_idr
        });
        return;
      }
    } else {
      auditChargeStatus = "bypassed_dev";
      auditChargeError = null;
      auditCostIdr = 0;
      auditBalanceBefore = null;
      auditBalanceAfter = null;
    }

    const analyzeSchema = buildAnalyzeJsonSchema(validation.nodeCount);
    let resultJson: unknown = null;
    let usage: { input_tokens?: number; output_tokens?: number } | undefined;
    let validationResult: "ok" | "retry_ok" | "failed" = "ok";

    if (provider.name === "openrouter" && structuredOutputMode === "openrouter_prompt_json") {
      const openrouterResult = await runOpenrouterAnalyze({
        provider,
        model: validation.model,
        input: validation.text,
        nodeCount: validation.nodeCount,
        lang: validation.lang
      });

      if (openrouterResult.ok === false) {
        const openrouterError = openrouterResult.error;
        if (openrouterError.code === "structured_output_invalid") {
          auditInputTokens = inputTokensEstimate;
          auditOutputTokens = 0;
          auditTotalTokens = inputTokensEstimate;
          auditUsageSource = "estimate_wordcount";
          auditProviderUsagePresent = false;
          auditCostIdr = 0;
          auditChargeStatus = "skipped";
          auditHttpStatus = 502;
          auditTerminationReason = "structured_output_invalid";
          await writeAudit();
          sendApiError(res, 502, {
            ok: false,
            request_id: requestId,
            code: "structured_output_invalid",
            error: "structured output invalid"
          });
          logLlmRequest({
            request_id: requestId,
            endpoint: "/api/llm/paper-analyze",
            user_id: userId,
            model: validation.model,
            provider_model_id: providerModelId,
            input_chars: validation.text.length,
            output_chars: 0,
            duration_ms: Date.now() - startedAt,
            status_code: 502,
            termination_reason: "structured_output_invalid",
            rupiah_cost: null,
            rupiah_balance_before: null,
            rupiah_balance_after: null,
            structured_output_mode: structuredOutputMode,
            validation_result: "failed"
          });
          return;
        }

        const status = mapLlmErrorToStatus(openrouterError as LlmError);
        auditInputTokens = inputTokensEstimate;
        auditOutputTokens = 0;
        auditTotalTokens = inputTokensEstimate;
        auditUsageSource = "estimate_wordcount";
        auditProviderUsagePresent = false;
        auditCostIdr = 0;
        auditChargeStatus = "skipped";
        auditHttpStatus = status;
        auditTerminationReason = mapTerminationReason(status, (openrouterError as LlmError).code);
        await writeAudit();
        sendApiError(res, status, {
          ok: false,
          request_id: requestId,
          code: (openrouterError as LlmError).code as ApiErrorCode,
          error: (openrouterError as LlmError).error
        });
        logLlmRequest({
          request_id: requestId,
          endpoint: "/api/llm/paper-analyze",
          user_id: userId,
          model: validation.model,
          provider_model_id: providerModelId,
          input_chars: validation.text.length,
          output_chars: 0,
          duration_ms: Date.now() - startedAt,
          status_code: status,
          termination_reason: mapTerminationReason(status, (openrouterError as LlmError).code),
          rupiah_cost: null,
          rupiah_balance_before: null,
          rupiah_balance_after: null,
          structured_output_mode: structuredOutputMode,
          validation_result: "failed"
        });
        return;
      }

      resultJson = openrouterResult.json;
      usage = openrouterResult.usage;
      providerUsage = normalizeUsage(usage) || null;
      validationResult = openrouterResult.validation_result;
    } else {
      const result = await provider.generateStructuredJson({
        model: validation.model,
        input: analyzeInput,
        schema: analyzeSchema
      });

      if (result.ok === false) {
        const llmError = result;
        const status = mapLlmErrorToStatus(llmError);
        auditInputTokens = inputTokensEstimate;
        auditOutputTokens = 0;
        auditTotalTokens = inputTokensEstimate;
        auditUsageSource = "estimate_wordcount";
        auditProviderUsagePresent = false;
        auditCostIdr = 0;
        auditChargeStatus = "skipped";
        auditHttpStatus = status;
        auditTerminationReason = mapTerminationReason(status, llmError.code);
        await writeAudit();
        sendApiError(res, status, {
          ok: false,
          request_id: requestId,
          code: llmError.code as ApiErrorCode,
          error: llmError.error
        });
        logLlmRequest({
          request_id: requestId,
          endpoint: "/api/llm/paper-analyze",
          user_id: userId,
          model: validation.model,
          provider_model_id: providerModelId,
          input_chars: validation.text.length,
          output_chars: 0,
          duration_ms: Date.now() - startedAt,
          status_code: status,
          termination_reason: mapTerminationReason(status, llmError.code),
          rupiah_cost: null,
          rupiah_balance_before: null,
          rupiah_balance_after: null,
          structured_output_mode: structuredOutputMode,
          validation_result: "failed"
        });
        return;
      }

      const validationCheck = validateAnalyzeJson(result.json, validation.nodeCount);
      if (!validationCheck.ok) {
        auditInputTokens = inputTokensEstimate;
        auditOutputTokens = 0;
        auditTotalTokens = inputTokensEstimate;
        auditUsageSource = "estimate_wordcount";
        auditProviderUsagePresent = false;
        auditCostIdr = 0;
        auditChargeStatus = "skipped";
        auditHttpStatus = 502;
        auditTerminationReason = "structured_output_invalid";
        await writeAudit();
        sendApiError(res, 502, {
          ok: false,
          request_id: requestId,
          code: "structured_output_invalid",
          error: "structured output invalid"
        });
        logLlmRequest({
          request_id: requestId,
          endpoint: "/api/llm/paper-analyze",
          user_id: userId,
          model: validation.model,
          provider_model_id: providerModelId,
          input_chars: validation.text.length,
          output_chars: 0,
          duration_ms: Date.now() - startedAt,
          status_code: 502,
          termination_reason: "structured_output_invalid",
          rupiah_cost: null,
          rupiah_balance_before: null,
          rupiah_balance_after: null,
          structured_output_mode: structuredOutputMode,
          validation_result: "failed"
        });
        return;
      }

      resultJson = validationCheck.value;
      usage = result.usage;
      providerUsage = normalizeUsage(result.usage) || null;
      validationResult = "ok";
    }

    const outputTextLength = JSON.stringify(resultJson || {}).length;
    usageTracker.recordOutputText(JSON.stringify(resultJson || {}));
    usageRecord = await usageTracker.finalize({ providerUsage });
    auditUsageSource = usageRecord.source;
    auditInputTokens = usageRecord.input_tokens;
    auditOutputTokens = usageRecord.output_tokens;
    auditTotalTokens = usageRecord.total_tokens;
    auditTokenizerEncoding = usageRecord.tokenizer_encoding_used ?? null;
    auditTokenizerFallback = usageRecord.tokenizer_fallback_reason ?? null;
    auditProviderUsagePresent = providerUsage ? true : false;
    const pricing = estimateIdrCost({
      model: validation.model,
      inputTokens: usageRecord.input_tokens,
      outputTokens: usageRecord.output_tokens,
      fxRate
    });
    if (bypassBalance) {
      rupiahCost = 0;
      rupiahBefore = null;
      rupiahAfter = null;
      auditCostIdr = 0;
      auditBalanceBefore = null;
      auditBalanceAfter = null;
      auditChargeStatus = "bypassed_dev";
      auditChargeError = null;
    } else {
      const chargeResult = await chargeForLlm({
        userId,
        requestId,
        amountIdr: pricing.idrCostRounded,
        meta: { model: validation.model, totalTokens: pricing.totalTokens }
      });
      if (chargeResult.ok === false) {
        const chargeError = chargeResult;
        const shortfall = pricing.idrCostRounded - chargeError.balance_idr;
        auditCostIdr = 0;
        auditBalanceBefore = chargeError.balance_idr;
        auditBalanceAfter = chargeError.balance_idr;
        auditChargeStatus = "failed";
        auditChargeError = "insufficient_rupiah";
        auditHttpStatus = 402;
        auditTerminationReason = "insufficient_rupiah";
        await writeAudit();
        res.setHeader("X-Request-Id", requestId);
        res.setHeader("X-Request-Id", requestId);
        res.status(402).json({
          ok: false,
          code: "insufficient_rupiah",
          request_id: requestId,
          needed_idr: pricing.idrCostRounded,
          balance_idr: chargeError.balance_idr,
          shortfall_idr: shortfall
        });
        logLlmRequest({
          request_id: requestId,
          endpoint: "/api/llm/paper-analyze",
          user_id: userId,
          model: validation.model,
          provider_model_id: providerModelId,
          input_chars: validation.text.length,
          output_chars: outputTextLength,
          duration_ms: Date.now() - startedAt,
          status_code: 402,
          termination_reason: "insufficient_rupiah",
          rupiah_cost: pricing.idrCostRounded,
          rupiah_balance_before: chargeError.balance_idr,
          rupiah_balance_after: chargeError.balance_idr
        });
        return;
      }

      rupiahCost = pricing.idrCostRounded;
      rupiahBefore = chargeResult.balance_before;
      rupiahAfter = chargeResult.balance_after;
      auditCostIdr = pricing.idrCostRounded;
      auditBalanceBefore = chargeResult.balance_before;
      auditBalanceAfter = chargeResult.balance_after;
      auditChargeStatus = "charged";
    }

    if (provider.name === "openai") {
      const eligible = router.policyMeta.cohort_selected && router.policyMeta.reason === "free_ok";
      if (eligible) {
        try {
          const applied = await recordTokenSpend({
            requestId,
            userId,
            dateKey: router.policyMeta.date_key,
            tokensUsed: usageRecord.total_tokens
          });
          freepoolApplied = applied.applied;
          freepoolDecrement = applied.applied ? usageRecord.total_tokens : 0;
          freepoolReason = applied.applied ? "applied" : "already_ledgered";
        } catch {
          freepoolApplied = false;
          freepoolReason = "error";
        }
      } else {
        freepoolApplied = false;
        freepoolReason = router.policyMeta.cohort_selected ? "cap_exhausted" : "not_in_cohort";
      }
    } else {
      freepoolApplied = false;
      freepoolReason = "provider_not_openai";
    }
    auditFreepoolApplied = freepoolApplied ?? false;
    auditFreepoolDecrement = freepoolDecrement ?? 0;
    auditFreepoolReason = freepoolReason;

    res.setHeader("X-Request-Id", requestId);
    res.json({ ok: true, request_id: requestId, json: resultJson });
    const outputSize = JSON.stringify(resultJson || {}).length;
    auditHttpStatus = 200;
    auditTerminationReason = "success";
    await writeAudit();
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/paper-analyze",
      user_id: userId,
      model: validation.model,
      provider_model_id: providerModelId,
      input_chars: validation.text.length,
      output_chars: outputSize,
      duration_ms: Date.now() - startedAt,
      status_code: 200,
      termination_reason: "success",
      provider: providerName,
      rupiah_cost: rupiahCost,
      rupiah_balance_before: rupiahBefore,
      rupiah_balance_after: rupiahAfter,
      usage_input_tokens: usageRecord?.input_tokens ?? null,
      usage_output_tokens: usageRecord?.output_tokens ?? null,
      usage_total_tokens: usageRecord?.total_tokens ?? null,
      usage_source: usageRecord?.source ?? null,
      provider_usage_present: providerUsage ? true : false,
      provider_usage_source: providerUsage ? providerName : null,
      provider_usage_fields_present: getUsageFieldList(providerUsage),
      tokenizer_encoding_used: usageRecord?.tokenizer_encoding_used ?? null,
      tokenizer_fallback_reason: usageRecord?.tokenizer_fallback_reason ?? null,
      freepool_decrement_tokens: freepoolDecrement,
      freepool_decrement_applied: freepoolApplied,
      freepool_decrement_reason: freepoolReason,
      structured_output_mode: structuredOutputMode,
      validation_result: validationResult
    });
  } finally {
    releaseLlmSlot(userId);
    llmRequestsInflight -= 1;
  }
});

app.get("/api/payments/:orderId/status", requireAuth, async (req, res) => {
  const user = res.locals.user as AuthContext;
  const orderId = String(req.params.orderId || "");
  if (!orderId) {
    res.status(400).json({ ok: false, error: "missing orderId" });
    return;
  }

  const pool = await getPool();
  const existing = await pool.query(
    `select order_id, status, payment_type, midtrans_transaction_id, paid_at, gross_amount
       from payment_transactions
      where order_id = $1 and user_id = $2`,
    [orderId, user.id]
  );

  const row = existing.rows[0];
  if (!row) {
    res.status(404).json({ ok: false, error: "not found" });
    return;
  }

  if (row.status === "pending") {
    const statusResult = await midtransRequest(`/v2/${orderId}/status`, { method: "GET" });
    if (statusResult.ok) {
      const data = statusResult.data as { transaction_status?: string; transaction_id?: string };
      const nextStatus = data.transaction_status || row.status;
      const now = new Date();
      const paidAt = isPaidStatus(nextStatus) ? now : null;

      try {
        await pool.query(
          `update payment_transactions
              set status = $2,
                  midtrans_transaction_id = coalesce($3, midtrans_transaction_id),
                  midtrans_response_json = $4,
                  updated_at = $5,
                  paid_at = case
                    when paid_at is null and $6 is not null then $6
                    else paid_at
                  end
            where order_id = $1`,
          [orderId, nextStatus, data.transaction_id || null, statusResult.data, now, paidAt]
        );
      } catch (e) {
        res.status(500).json({ ok: false, error: "failed to update status" });
        return;
      }

      if (paidAt) {
        try {
        await applyTopupFromMidtrans({
          userId: String(user.id),
          orderId,
          amountIdr: Number(row.gross_amount || 0)
        });
        } catch {
          // Ignore credit application failures here.
        }
      }

      res.json({
        ok: true,
        order_id: orderId,
        status: nextStatus,
        payment_type: row.payment_type,
        transaction_id: data.transaction_id || row.midtrans_transaction_id,
        paid_at: paidAt || row.paid_at || null
      });
      return;
    }

    let midtransError: unknown = null;
    if (statusResult.ok === false) {
      midtransError = statusResult.error;
    }

    res.json({
      ok: true,
      order_id: orderId,
      status: row.status,
      payment_type: row.payment_type,
      transaction_id: row.midtrans_transaction_id,
      paid_at: row.paid_at || null,
      midtrans_error: midtransError
    });
    return;
  }

  if (row.paid_at) {
    try {
      await applyTopupFromMidtrans({
        userId: String(user.id),
        orderId,
        amountIdr: Number(row.gross_amount || 0)
      });
    } catch {
      // Ignore credit application failures here.
    }
  }

  res.json({
    ok: true,
    order_id: orderId,
    status: row.status,
    payment_type: row.payment_type,
    transaction_id: row.midtrans_transaction_id,
    paid_at: row.paid_at || null
  });
});

app.post("/api/llm/prefill", requireAuth, async (req, res) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  llmRequestsTotal += 1;
  llmRequestsInflight += 1;
  const user = res.locals.user as AuthContext;
  const userId = getUserId(user);
  let rupiahCost: number | null = null;
  let rupiahBefore: number | null = null;
  let rupiahAfter: number | null = null;
  let fxRate = 0;
  let providerName: "openai" | "openrouter" | null = null;
  let usageRecord: UsageRecord | null = null;
  let freepoolDecrement: number | null = null;
  let freepoolApplied: boolean | null = null;
  let freepoolReason: string | null = null;
  let providerUsage: ProviderUsage | null = null;
  let auditWritten = false;
  let auditSelectedProvider = "unknown";
  let auditActualProvider = "unknown";
  let auditLogicalModel = typeof req.body?.model === "string" ? req.body.model : "unknown";
  let auditProviderModelId = "unknown";
  let auditUsageSource = "estimate_wordcount";
  let auditInputTokens = 0;
  let auditOutputTokens = 0;
  let auditTotalTokens = 0;
  let auditTokenizerEncoding: string | null = null;
  let auditTokenizerFallback: string | null = null;
  let auditProviderUsagePresent = false;
  let auditFxRate: number | null = null;
  let auditPriceUsdPerM = getPriceUsdPerM(auditLogicalModel);
  let auditCostIdr = 0;
  let auditBalanceBefore: number | null = null;
  let auditBalanceAfter: number | null = null;
  let auditChargeStatus = "unknown";
  let auditChargeError: string | null = null;
  let auditFreepoolApplied = false;
  let auditFreepoolDecrement = 0;
  let auditFreepoolReason: string | null = null;
  let auditHttpStatus: number | null = null;
  let auditTerminationReason: string | null = null;

  async function writeAudit() {
    if (auditWritten) return;
    auditWritten = true;
    try {
      await upsertAuditRecord({
        request_id: requestId,
        user_id: userId,
        endpoint_kind: "prefill",
        selected_provider: auditSelectedProvider,
        actual_provider_used: auditActualProvider,
        logical_model: auditLogicalModel,
        provider_model_id: auditProviderModelId,
        usage_source: auditUsageSource,
        input_tokens: auditInputTokens,
        output_tokens: auditOutputTokens,
        total_tokens: auditTotalTokens,
        tokenizer_encoding_used: auditTokenizerEncoding,
        tokenizer_fallback_reason: auditTokenizerFallback,
        provider_usage_present: auditProviderUsagePresent,
        fx_usd_idr: auditFxRate,
        price_usd_per_mtoken: auditPriceUsdPerM,
        markup_multiplier: MARKUP_MULTIPLIER,
        cost_idr: auditCostIdr,
        balance_before_idr: auditBalanceBefore,
        balance_after_idr: auditBalanceAfter,
        charge_status: auditChargeStatus,
        charge_error_code: auditChargeError,
        freepool_applied: auditFreepoolApplied,
        freepool_decrement_tokens: auditFreepoolDecrement,
        freepool_reason: auditFreepoolReason,
        http_status: auditHttpStatus,
        termination_reason: auditTerminationReason
      });
    } catch {
      // Ignore audit write failures.
    }
  }

  const validationResult = validatePrefill(req.body);
  if (isValidationError(validationResult)) {
    auditHttpStatus = validationResult.status;
    auditTerminationReason = "validation_error";
    auditChargeStatus = "skipped";
    await writeAudit();
    sendApiError(res, validationResult.status, {
      ok: false,
      request_id: requestId,
      code: validationResult.code,
      error: validationResult.error
    });
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/prefill",
      user_id: userId,
      model: req.body?.model || "unknown",
      input_chars: typeof req.body?.nodeLabel === "string" ? req.body.nodeLabel.length : 0,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: validationResult.status,
      termination_reason: "validation_error",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    llmRequestsInflight -= 1;
    return;
  }
  const validation = validationResult;

  if (!acquireLlmSlot(userId)) {
    auditHttpStatus = 429;
    auditTerminationReason = "rate_limited";
    auditChargeStatus = "skipped";
    await writeAudit();
    sendApiError(res, 429, {
      ok: false,
      request_id: requestId,
      code: "rate_limited",
      error: "too many concurrent requests"
    });
    res.setHeader("Retry-After", "5");
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/prefill",
      user_id: userId,
      model: validation.model,
      input_chars: validation.nodeLabel.length,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: 429,
      termination_reason: "rate_limited",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    llmRequestsInflight -= 1;
    return;
  }

  try {
    auditLogicalModel = validation.model;
    auditPriceUsdPerM = getPriceUsdPerM(validation.model);
    const router = await pickProviderForRequest({ userId, endpointKind: "prefill" });
    const provider = router.provider;
    providerName = provider.name;
    auditSelectedProvider = router.selectedProviderName;
    auditActualProvider = provider.name;
    const providerModelId = mapModel(provider.name, validation.model);
    auditProviderModelId = providerModelId;
    console.log(`[llm] provider_policy selected=${router.selectedProviderName} actual_provider=${provider.name} logical_model=${validation.model} provider_model_id=${providerModelId} cohort=${router.policyMeta.cohort_selected} used_tokens=${router.policyMeta.user_used_tokens_today} pool_remaining=${router.policyMeta.pool_remaining_tokens} cap=${router.policyMeta.user_free_cap} reason=${router.policyMeta.reason} date_key=${router.policyMeta.date_key}`);

    const promptParts: string[] = [];
    promptParts.push(`Target Node: ${validation.nodeLabel}`);
    if (validation.content) {
      promptParts.push(`Node Knowledge: \"${validation.content.title}\" - ${validation.content.summary.slice(0, 150)}...`);
    }
    if (validation.miniChatMessages && validation.miniChatMessages.length > 0) {
      const recent = validation.miniChatMessages.slice(-4);
      promptParts.push("Recent Chat History:");
      for (const msg of recent) {
        const text = msg.text.length > 300 ? `${msg.text.slice(0, 300)}...` : msg.text;
        promptParts.push(`${msg.role.toUpperCase()}: ${text}`);
      }
    } else {
      promptParts.push("(No previous chat history)");
    }

    const systemPrompt = [
      "You are generating ONE suggested prompt to prefill a chat input.",
      "Rules:",
      "- One line only.",
      "- Actionable and specific to the node.",
      "- No prefixes like \"suggested prompt:\".",
      "- No quotes.",
      "- Max 160 characters.",
      "- Tone: calm, analytical, dark-elegant.",
      "- Return ONLY the prompt text."
    ].join("\n");

    const input = `${systemPrompt}\n\nCONTEXT:\n${promptParts.join("\n")}`;

    const usageTracker = initUsageTracker({
      provider: provider.name,
      logical_model: validation.model,
      provider_model_id: providerModelId,
      request_id: requestId
    });
    usageTracker.recordInputText(input);
    const inputTokensEstimate = usageTracker.getInputTokensEstimate();
    const fx = await getUsdToIdr();
    fxRate = fx.rate;
    const estimated = estimateIdrCost({
      model: validation.model,
      inputTokens: inputTokensEstimate,
      outputTokens: 0,
      fxRate
    });
    const bypassBalance = isDevBalanceBypassEnabled();
    if (!bypassBalance) {
      const balanceSnapshot = await getBalance(userId);
      if (balanceSnapshot.balance_idr < estimated.idrCostRounded) {
        const shortfall = estimated.idrCostRounded - balanceSnapshot.balance_idr;
        auditInputTokens = inputTokensEstimate;
        auditOutputTokens = 0;
        auditTotalTokens = inputTokensEstimate;
        auditUsageSource = "estimate_wordcount";
        auditProviderUsagePresent = false;
        auditCostIdr = 0;
        auditBalanceBefore = balanceSnapshot.balance_idr;
        auditBalanceAfter = balanceSnapshot.balance_idr;
        auditChargeStatus = "failed";
        auditChargeError = "insufficient_rupiah";
        auditHttpStatus = 402;
        auditTerminationReason = "insufficient_rupiah";
        await writeAudit();
        res.status(402).json({
          ok: false,
          code: "insufficient_rupiah",
          request_id: requestId,
          needed_idr: estimated.idrCostRounded,
          balance_idr: balanceSnapshot.balance_idr,
          shortfall_idr: shortfall
        });
        logLlmRequest({
          request_id: requestId,
          endpoint: "/api/llm/prefill",
          user_id: userId,
          model: validation.model,
          provider_model_id: providerModelId,
          input_chars: validation.nodeLabel.length,
          output_chars: 0,
          duration_ms: Date.now() - startedAt,
          status_code: 402,
          termination_reason: "insufficient_rupiah",
          rupiah_cost: estimated.idrCostRounded,
          rupiah_balance_before: balanceSnapshot.balance_idr,
          rupiah_balance_after: balanceSnapshot.balance_idr
        });
        return;
      }
    } else {
      auditChargeStatus = "bypassed_dev";
      auditChargeError = null;
      auditCostIdr = 0;
      auditBalanceBefore = null;
      auditBalanceAfter = null;
    }

    const result = await provider.generateText({
      model: validation.model,
      input
    });

    if (result.ok === false) {
      const llmError = result;
      const status = mapLlmErrorToStatus(llmError);
      auditInputTokens = inputTokensEstimate;
      auditOutputTokens = 0;
      auditTotalTokens = inputTokensEstimate;
      auditUsageSource = "estimate_wordcount";
      auditProviderUsagePresent = false;
      auditCostIdr = 0;
      auditChargeStatus = "skipped";
      auditHttpStatus = status;
      auditTerminationReason = mapTerminationReason(status, llmError.code);
      await writeAudit();
      sendApiError(res, status, {
        ok: false,
        request_id: requestId,
        code: llmError.code as ApiErrorCode,
        error: llmError.error
      });
      logLlmRequest({
        request_id: requestId,
        endpoint: "/api/llm/prefill",
        user_id: userId,
        model: validation.model,
        provider_model_id: providerModelId,
        input_chars: validation.nodeLabel.length,
        output_chars: 0,
        duration_ms: Date.now() - startedAt,
        status_code: status,
        termination_reason: mapTerminationReason(status, llmError.code),
        rupiah_cost: null,
        rupiah_balance_before: null,
        rupiah_balance_after: null
      });
      return;
    }

    usageTracker.recordOutputText(result.text);
    providerUsage = normalizeUsage(result.usage) || null;
    usageRecord = await usageTracker.finalize({ providerUsage });
    auditUsageSource = usageRecord.source;
    auditInputTokens = usageRecord.input_tokens;
    auditOutputTokens = usageRecord.output_tokens;
    auditTotalTokens = usageRecord.total_tokens;
    auditTokenizerEncoding = usageRecord.tokenizer_encoding_used ?? null;
    auditTokenizerFallback = usageRecord.tokenizer_fallback_reason ?? null;
    auditProviderUsagePresent = providerUsage ? true : false;
    const pricing = estimateIdrCost({
      model: validation.model,
      inputTokens: usageRecord.input_tokens,
      outputTokens: usageRecord.output_tokens,
      fxRate
    });
    if (bypassBalance) {
      rupiahCost = 0;
      rupiahBefore = null;
      rupiahAfter = null;
      auditCostIdr = 0;
      auditBalanceBefore = null;
      auditBalanceAfter = null;
      auditChargeStatus = "bypassed_dev";
      auditChargeError = null;
    } else {
      const chargeResult = await chargeForLlm({
        userId,
        requestId,
        amountIdr: pricing.idrCostRounded,
        meta: { model: validation.model, totalTokens: pricing.totalTokens }
      });
      if (chargeResult.ok === false) {
        const chargeError = chargeResult;
        const shortfall = pricing.idrCostRounded - chargeError.balance_idr;
        auditCostIdr = 0;
        auditBalanceBefore = chargeError.balance_idr;
        auditBalanceAfter = chargeError.balance_idr;
        auditChargeStatus = "failed";
        auditChargeError = "insufficient_rupiah";
        auditHttpStatus = 402;
        auditTerminationReason = "insufficient_rupiah";
        await writeAudit();
        res.status(402).json({
          ok: false,
          code: "insufficient_rupiah",
          request_id: requestId,
          needed_idr: pricing.idrCostRounded,
          balance_idr: chargeError.balance_idr,
          shortfall_idr: shortfall
        });
        logLlmRequest({
          request_id: requestId,
          endpoint: "/api/llm/prefill",
          user_id: userId,
          model: validation.model,
          provider_model_id: providerModelId,
          input_chars: validation.nodeLabel.length,
          output_chars: result.text.length,
          duration_ms: Date.now() - startedAt,
          status_code: 402,
          termination_reason: "insufficient_rupiah",
          rupiah_cost: pricing.idrCostRounded,
          rupiah_balance_before: chargeError.balance_idr,
          rupiah_balance_after: chargeError.balance_idr
        });
        return;
      }

      rupiahCost = pricing.idrCostRounded;
      rupiahBefore = chargeResult.balance_before;
      rupiahAfter = chargeResult.balance_after;
    }

    if (provider.name === "openai") {
      const eligible = router.policyMeta.cohort_selected && router.policyMeta.reason === "free_ok";
      if (eligible) {
        try {
          const applied = await recordTokenSpend({
            requestId,
            userId,
            dateKey: router.policyMeta.date_key,
            tokensUsed: usageRecord.total_tokens
          });
          freepoolApplied = applied.applied;
          freepoolDecrement = applied.applied ? usageRecord.total_tokens : 0;
          freepoolReason = applied.applied ? "applied" : "already_ledgered";
        } catch {
          freepoolApplied = false;
          freepoolReason = "error";
        }
      } else {
        freepoolApplied = false;
        freepoolReason = router.policyMeta.cohort_selected ? "cap_exhausted" : "not_in_cohort";
      }
    } else {
      freepoolApplied = false;
      freepoolReason = "provider_not_openai";
    }
    auditFreepoolApplied = freepoolApplied ?? false;
    auditFreepoolDecrement = freepoolDecrement ?? 0;
    auditFreepoolReason = freepoolReason;

    res.setHeader("X-Request-Id", requestId);
    res.json({ ok: true, request_id: requestId, prompt: result.text });
    auditHttpStatus = 200;
    auditTerminationReason = "success";
    await writeAudit();
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/prefill",
      user_id: userId,
      model: validation.model,
      provider_model_id: providerModelId,
      input_chars: validation.nodeLabel.length,
      output_chars: result.text.length,
      duration_ms: Date.now() - startedAt,
      status_code: 200,
      termination_reason: "success",
      provider: providerName,
      rupiah_cost: rupiahCost,
      rupiah_balance_before: rupiahBefore,
      rupiah_balance_after: rupiahAfter,
      usage_input_tokens: usageRecord?.input_tokens ?? null,
      usage_output_tokens: usageRecord?.output_tokens ?? null,
      usage_total_tokens: usageRecord?.total_tokens ?? null,
      usage_source: usageRecord?.source ?? null,
      provider_usage_present: providerUsage ? true : false,
      provider_usage_source: providerUsage ? providerName : null,
      provider_usage_fields_present: getUsageFieldList(providerUsage),
      tokenizer_encoding_used: usageRecord?.tokenizer_encoding_used ?? null,
      tokenizer_fallback_reason: usageRecord?.tokenizer_fallback_reason ?? null,
      freepool_decrement_tokens: freepoolDecrement,
      freepool_decrement_applied: freepoolApplied,
      freepool_decrement_reason: freepoolReason
    });
  } finally {
    releaseLlmSlot(userId);
    llmRequestsInflight -= 1;
  }
});

app.post("/api/llm/chat", requireAuth, async (req, res) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  llmRequestsTotal += 1;
  llmRequestsInflight += 1;
  llmRequestsStreaming += 1;
  const user = res.locals.user as AuthContext;
  const userId = getUserId(user);
  let rupiahCost: number | null = null;
  let rupiahBefore: number | null = null;
  let rupiahAfter: number | null = null;
  let fxRate = 0;
  let providerName: "openai" | "openrouter" | null = null;
  let providerModelId = "";
  let usageRecord: UsageRecord | null = null;
  let freepoolDecrement: number | null = null;
  let freepoolApplied: boolean | null = null;
  let freepoolReason: string | null = null;
  let providerUsage: ProviderUsage | null = null;
  let policyMeta: ProviderPolicyMeta | null = null;
  let auditWritten = false;
  let auditSelectedProvider = "unknown";
  let auditActualProvider = "unknown";
  let auditLogicalModel = typeof req.body?.model === "string" ? req.body.model : "unknown";
  let auditProviderModelId = "unknown";
  let auditUsageSource = "estimate_wordcount";
  let auditInputTokens = 0;
  let auditOutputTokens = 0;
  let auditTotalTokens = 0;
  let auditTokenizerEncoding: string | null = null;
  let auditTokenizerFallback: string | null = null;
  let auditProviderUsagePresent = false;
  let auditFxRate: number | null = null;
  let auditPriceUsdPerM = getPriceUsdPerM(auditLogicalModel);
  let auditCostIdr = 0;
  let auditBalanceBefore: number | null = null;
  let auditBalanceAfter: number | null = null;
  let auditChargeStatus = "unknown";
  let auditChargeError: string | null = null;
  let auditFreepoolApplied = false;
  let auditFreepoolDecrement = 0;
  let auditFreepoolReason: string | null = null;
  let auditHttpStatus: number | null = null;
  let auditTerminationReason: string | null = null;

  async function writeAudit() {
    if (auditWritten) return;
    auditWritten = true;
    try {
      await upsertAuditRecord({
        request_id: requestId,
        user_id: userId,
        endpoint_kind: "chat",
        selected_provider: auditSelectedProvider,
        actual_provider_used: auditActualProvider,
        logical_model: auditLogicalModel,
        provider_model_id: auditProviderModelId,
        usage_source: auditUsageSource,
        input_tokens: auditInputTokens,
        output_tokens: auditOutputTokens,
        total_tokens: auditTotalTokens,
        tokenizer_encoding_used: auditTokenizerEncoding,
        tokenizer_fallback_reason: auditTokenizerFallback,
        provider_usage_present: auditProviderUsagePresent,
        fx_usd_idr: auditFxRate,
        price_usd_per_mtoken: auditPriceUsdPerM,
        markup_multiplier: MARKUP_MULTIPLIER,
        cost_idr: auditCostIdr,
        balance_before_idr: auditBalanceBefore,
        balance_after_idr: auditBalanceAfter,
        charge_status: auditChargeStatus,
        charge_error_code: auditChargeError,
        freepool_applied: auditFreepoolApplied,
        freepool_decrement_tokens: auditFreepoolDecrement,
        freepool_reason: auditFreepoolReason,
        http_status: auditHttpStatus,
        termination_reason: auditTerminationReason
      });
    } catch {
      // Ignore audit write failures.
    }
  }

  const validationResult = validateChat(req.body);
  if (isValidationError(validationResult)) {
    auditHttpStatus = validationResult.status;
    auditTerminationReason = "validation_error";
    auditChargeStatus = "skipped";
    await writeAudit();
    sendApiError(res, validationResult.status, {
      ok: false,
      request_id: requestId,
      code: validationResult.code,
      error: validationResult.error
    });
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/chat",
      user_id: userId,
      model: req.body?.model || "unknown",
      input_chars: typeof req.body?.userPrompt === "string" ? req.body.userPrompt.length : 0,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: validationResult.status,
      termination_reason: "validation_error",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    llmRequestsInflight -= 1;
    llmRequestsStreaming -= 1;
    return;
  }
  const validation = validationResult;

  if (!acquireLlmSlot(userId)) {
    auditHttpStatus = 429;
    auditTerminationReason = "rate_limited";
    auditChargeStatus = "skipped";
    await writeAudit();
    sendApiError(res, 429, {
      ok: false,
      request_id: requestId,
      code: "rate_limited",
      error: "too many concurrent requests"
    });
    res.setHeader("Retry-After", "5");
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/chat",
      user_id: userId,
      model: validation.model,
      input_chars: validation.userPrompt.length,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: 429,
      termination_reason: "rate_limited",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    llmRequestsInflight -= 1;
    llmRequestsStreaming -= 1;
    return;
  }

  let statusCode = 200;
  let streamStarted = false;
  let cancelled = false;
  let outputChars = 0;
  let firstTokenAt: number | null = null;
  let terminationReason = "success";
  let chatInput = "";
  let bypassBalance = isDevBalanceBypassEnabled();
  let usageTracker: ReturnType<typeof initUsageTracker> | null = null;
  let stream: { providerUsagePromise?: Promise<ProviderUsage | null> } | null = null;
  req.on("close", () => {
    cancelled = true;
  });

  try {
    auditLogicalModel = validation.model;
    auditPriceUsdPerM = getPriceUsdPerM(validation.model);
    const router = await pickProviderForRequest({ userId, endpointKind: "chat" });
    const provider = router.provider;
    providerName = provider.name;
    policyMeta = router.policyMeta;
    providerModelId = mapModel(provider.name, validation.model);
    auditSelectedProvider = router.selectedProviderName;
    auditActualProvider = provider.name;
    auditProviderModelId = providerModelId;
    console.log(`[llm] provider_policy selected=${router.selectedProviderName} actual_provider=${provider.name} logical_model=${validation.model} provider_model_id=${providerModelId} cohort=${router.policyMeta.cohort_selected} used_tokens=${router.policyMeta.user_used_tokens_today} pool_remaining=${router.policyMeta.pool_remaining_tokens} cap=${router.policyMeta.user_free_cap} reason=${router.policyMeta.reason} date_key=${router.policyMeta.date_key}`);

    const systemPrompt = validation.systemPrompt || "";
    chatInput = `${systemPrompt}\n\nUSER PROMPT:\n${validation.userPrompt}`;
    usageTracker = initUsageTracker({
      provider: provider.name,
      logical_model: validation.model,
      provider_model_id: providerModelId,
      request_id: requestId
    });
    const chatMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: validation.userPrompt }
    ];
    usageTracker.recordInputMessages(chatMessages);
    const inputTokensEstimate = usageTracker.getInputTokensEstimate();
    const fx = await getUsdToIdr();
    fxRate = fx.rate;
    const estimated = estimateIdrCost({
      model: validation.model,
      inputTokens: inputTokensEstimate,
      outputTokens: 0,
      fxRate
    });
    if (!bypassBalance) {
      const balanceSnapshot = await getBalance(userId);
      if (balanceSnapshot.balance_idr < estimated.idrCostRounded) {
        const shortfall = estimated.idrCostRounded - balanceSnapshot.balance_idr;
        auditInputTokens = inputTokensEstimate;
        auditOutputTokens = 0;
        auditTotalTokens = inputTokensEstimate;
        auditUsageSource = "estimate_wordcount";
        auditProviderUsagePresent = false;
        auditCostIdr = 0;
        auditBalanceBefore = balanceSnapshot.balance_idr;
        auditBalanceAfter = balanceSnapshot.balance_idr;
        auditChargeStatus = "failed";
        auditChargeError = "insufficient_rupiah";
        auditHttpStatus = 402;
        auditTerminationReason = "insufficient_rupiah";
        await writeAudit();
        res.status(402).json({
          ok: false,
          code: "insufficient_rupiah",
          request_id: requestId,
          needed_idr: estimated.idrCostRounded,
          balance_idr: balanceSnapshot.balance_idr,
          shortfall_idr: shortfall
        });
        logLlmRequest({
          request_id: requestId,
          endpoint: "/api/llm/chat",
          user_id: userId,
          model: validation.model,
          provider_model_id: providerModelId,
          input_chars: validation.userPrompt.length,
          output_chars: 0,
          duration_ms: Date.now() - startedAt,
          status_code: 402,
          termination_reason: "insufficient_rupiah",
          rupiah_cost: estimated.idrCostRounded,
          rupiah_balance_before: balanceSnapshot.balance_idr,
          rupiah_balance_after: balanceSnapshot.balance_idr
        });
        statusCode = 402;
        terminationReason = "insufficient_rupiah";
        return;
      }
    } else {
      auditChargeStatus = "bypassed_dev";
      auditChargeError = null;
      auditCostIdr = 0;
      auditBalanceBefore = null;
      auditBalanceAfter = null;
    }

    stream = provider.generateTextStream({
      model: validation.model,
      input: chatInput
    });

    res.setHeader("X-Request-Id", requestId);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    for await (const chunk of stream as any) {
      if (cancelled) break;
      if (!streamStarted) {
        streamStarted = true;
        firstTokenAt = Date.now();
      }
      outputChars += chunk.length;
      usageTracker.recordOutputChunk(chunk);
      res.write(chunk);
    }

    res.end();
    statusCode = 200;
    if (cancelled) {
      terminationReason = "client_abort";
      statusCode = 499;
    }
  } catch (err: any) {
    const info = err?.info as LlmError | undefined;
    if (!streamStarted) {
      if (info) {
        statusCode = mapLlmErrorToStatus(info);
        sendApiError(res, statusCode, {
          ok: false,
          request_id: requestId,
          code: info.code as ApiErrorCode,
          error: info.error
        });
        terminationReason = mapTerminationReason(statusCode, info.code);
      } else {
        statusCode = 502;
        sendApiError(res, statusCode, {
          ok: false,
          request_id: requestId,
          code: "upstream_error",
          error: "stream failed"
        });
        terminationReason = "upstream_error";
      }
    } else {
      statusCode = 502;
      res.end();
      terminationReason = "upstream_error";
    }
  } finally {
    if (!usageTracker) {
      usageTracker = initUsageTracker({
        provider: providerName ?? "openai",
        logical_model: validation.model,
        provider_model_id: providerModelId || "unknown",
        request_id: requestId
      });
      const chatMessages = [
        { role: "system", content: validation.systemPrompt || "" },
        { role: "user", content: validation.userPrompt }
      ];
      usageTracker.recordInputMessages(chatMessages);
    }
    if (providerUsage === null) {
      const streamUsage = stream?.providerUsagePromise;
      if (streamUsage) {
        try {
          providerUsage = await streamUsage;
        } catch {
          providerUsage = null;
        }
      }
    }
    usageRecord = await usageTracker.finalize({ providerUsage });
    auditUsageSource = usageRecord.source;
    auditInputTokens = usageRecord.input_tokens;
    auditOutputTokens = usageRecord.output_tokens;
    auditTotalTokens = usageRecord.total_tokens;
    auditTokenizerEncoding = usageRecord.tokenizer_encoding_used ?? null;
    auditTokenizerFallback = usageRecord.tokenizer_fallback_reason ?? null;
    auditProviderUsagePresent = providerUsage ? true : false;
    const pricing = estimateIdrCost({
      model: validation.model,
      inputTokens: usageRecord.input_tokens,
      outputTokens: usageRecord.output_tokens,
      fxRate
    });
    if (bypassBalance) {
      rupiahCost = 0;
      rupiahBefore = null;
      rupiahAfter = null;
      auditCostIdr = 0;
      auditBalanceBefore = null;
      auditBalanceAfter = null;
      auditChargeStatus = "bypassed_dev";
      auditChargeError = null;
    } else {
      const chargeResult = await chargeForLlm({
        userId,
        requestId,
        amountIdr: pricing.idrCostRounded,
        meta: { model: validation.model, totalTokens: pricing.totalTokens }
      });
      if (chargeResult.ok === true) {
        rupiahCost = pricing.idrCostRounded;
        rupiahBefore = chargeResult.balance_before;
        rupiahAfter = chargeResult.balance_after;
        auditCostIdr = pricing.idrCostRounded;
        auditBalanceBefore = chargeResult.balance_before;
        auditBalanceAfter = chargeResult.balance_after;
        auditChargeStatus = "charged";
      } else {
        const chargeError = chargeResult;
        terminationReason = "insufficient_rupiah";
        auditCostIdr = 0;
        auditBalanceBefore = chargeError.balance_idr;
        auditBalanceAfter = chargeError.balance_idr;
        auditChargeStatus = "failed";
        auditChargeError = "insufficient_rupiah";
      }
    }

    if (providerName === "openai" && policyMeta) {
      const eligible = policyMeta.cohort_selected && policyMeta.reason === "free_ok";
      if (eligible) {
        try {
          const applied = await recordTokenSpend({
            requestId,
            userId,
            dateKey: policyMeta.date_key,
            tokensUsed: usageRecord.total_tokens
          });
          freepoolApplied = applied.applied;
          freepoolDecrement = applied.applied ? usageRecord.total_tokens : 0;
          freepoolReason = applied.applied ? "applied" : "already_ledgered";
        } catch {
          freepoolApplied = false;
          freepoolReason = "error";
        }
      } else {
        freepoolApplied = false;
        freepoolReason = policyMeta.cohort_selected ? "cap_exhausted" : "not_in_cohort";
      }
    } else {
      freepoolApplied = false;
      freepoolReason = policyMeta ? "provider_not_openai" : "policy_missing";
    }
    auditFreepoolApplied = freepoolApplied ?? false;
    auditFreepoolDecrement = freepoolDecrement ?? 0;
    auditFreepoolReason = freepoolReason;

    releaseLlmSlot(userId);
    llmRequestsInflight -= 1;
    llmRequestsStreaming -= 1;
    auditHttpStatus = statusCode;
    auditTerminationReason = terminationReason;
    await writeAudit();
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/chat",
      user_id: userId,
      model: validation.model,
      provider_model_id: providerModelId || null,
      input_chars: validation.userPrompt.length,
      output_chars: outputChars,
      duration_ms: Date.now() - startedAt,
      time_to_first_token_ms: firstTokenAt ? firstTokenAt - startedAt : null,
      status_code: statusCode,
      termination_reason: terminationReason,
      provider: providerName,
      rupiah_cost: rupiahCost,
      rupiah_balance_before: rupiahBefore,
      rupiah_balance_after: rupiahAfter,
      usage_input_tokens: usageRecord?.input_tokens ?? null,
      usage_output_tokens: usageRecord?.output_tokens ?? null,
      usage_total_tokens: usageRecord?.total_tokens ?? null,
      usage_source: usageRecord?.source ?? null,
      provider_usage_present: providerUsage ? true : false,
      provider_usage_source: providerUsage ? providerName : null,
      provider_usage_fields_present: getUsageFieldList(providerUsage),
      tokenizer_encoding_used: usageRecord?.tokenizer_encoding_used ?? null,
      tokenizer_fallback_reason: usageRecord?.tokenizer_fallback_reason ?? null,
      freepool_decrement_tokens: freepoolDecrement,
      freepool_decrement_applied: freepoolApplied,
      freepool_decrement_reason: freepoolReason
    });
  }
});

async function startServer() {
  const allowDevBootWithoutDb = !isProd() && process.env.ALLOW_DEV_START_WITHOUT_DB !== "0";
  try {
    const schema = await assertAuthSchemaReady();
    profileColumnsAvailable = await detectProfileColumnsAvailability();
    console.log(`[admin] allowlist loaded count=${ADMIN_EMAIL_ALLOWLIST_SET.size}`);
    console.log(
      `[auth-schema] ready db=${schema.dbTarget} tables=${schema.tables.join(",")} fk_sessions_user=${schema.hasSessionsUserFk} uq_users_google_sub=${schema.hasUsersGoogleSubUnique} uq_sessions_id=${schema.hasSessionsIdUnique}`
    );
    console.log(`[auth-schema] profile_columns_available=${profileColumnsAvailable}`);
    app.listen(port, () => {
      console.log(`[server] listening on ${port}`);
    });
  } catch (error) {
    if (!allowDevBootWithoutDb) {
      console.error(`[auth-schema] fatal startup failure: ${String(error)}`);
      process.exit(1);
      return;
    }

    profileColumnsAvailable = false;
    console.warn(`[auth-schema] startup degraded mode enabled: ${String(error)}`);
    console.warn("[auth-schema] continuing boot in dev without DB readiness checks");
    console.log(`[admin] allowlist loaded count=${ADMIN_EMAIL_ALLOWLIST_SET.size}`);
    app.listen(port, () => {
      console.log(`[server] listening on ${port} (degraded mode)`);
    });
  }
}

void startServer();
