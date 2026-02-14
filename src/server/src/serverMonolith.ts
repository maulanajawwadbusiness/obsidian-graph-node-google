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
import { registerLlmAnalyzeRoute } from "./routes/llmAnalyzeRoute";
import { registerLlmPrefillRoute } from "./routes/llmPrefillRoute";
import { registerLlmChatRoute } from "./routes/llmChatRoute";
import type {
  LlmAnalyzeRouteDeps,
  LlmPrefillRouteDeps,
  LlmChatRouteDeps
} from "./routes/llmRouteDeps";

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
let profileColumnsAvailable = false;
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

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

const llmRouteCommonDeps = {
  requireAuth,
  getUserId,
  acquireLlmSlot,
  releaseLlmSlot,
  sendApiError,
  isValidationError,
  logLlmRequest,
  mapLlmErrorToStatus,
  mapTerminationReason,
  getUsageFieldList,
  getPriceUsdPerM,
  isDevBalanceBypassEnabled,
  incRequestsTotal: () => {
    llmRequestsTotal += 1;
  },
  incRequestsInflight: () => {
    llmRequestsInflight += 1;
  },
  decRequestsInflight: () => {
    llmRequestsInflight -= 1;
  }
};

const llmAnalyzeRouteDeps: LlmAnalyzeRouteDeps = {
  ...llmRouteCommonDeps,
  isOpenrouterAnalyzeAllowed
};

const llmPrefillRouteDeps: LlmPrefillRouteDeps = {
  ...llmRouteCommonDeps
};

const llmChatRouteDeps: LlmChatRouteDeps = {
  ...llmRouteCommonDeps,
  incRequestsStreaming: () => {
    llmRequestsStreaming += 1;
  },
  decRequestsStreaming: () => {
    llmRequestsStreaming -= 1;
  }
};

registerLlmAnalyzeRoute(app, llmAnalyzeRouteDeps);

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

registerLlmPrefillRoute(app, llmPrefillRouteDeps);
registerLlmChatRoute(app, llmChatRouteDeps);

async function startServer() {
  try {
    const schema = await assertAuthSchemaReady();
    profileColumnsAvailable = await detectProfileColumnsAvailability();
    console.log(
      `[auth-schema] ready db=${schema.dbTarget} tables=${schema.tables.join(",")} fk_sessions_user=${schema.hasSessionsUserFk} uq_users_google_sub=${schema.hasUsersGoogleSubUnique} uq_sessions_id=${schema.hasSessionsIdUnique}`
    );
    console.log(`[auth-schema] profile_columns_available=${profileColumnsAvailable}`);
    app.listen(port, () => {
      console.log(`[server] listening on ${port}`);
    });
  } catch (error) {
    console.error(`[auth-schema] fatal startup failure: ${String(error)}`);
    process.exit(1);
  }
}

void startServer();
