import crypto from "crypto";
import cors from "cors";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { getPool } from "./db";
import { getUsdToIdr } from "./fx/fxService";
import { midtransRequest } from "./midtrans/client";
import { recordTokenSpend } from "./llm/freePoolAccounting";
import { type LlmError } from "./llm/llmClient";
import { LLM_LIMITS } from "./llm/limits";
import { pickProviderForRequest } from "./llm/providerRouter";
import { validateChat, validatePaperAnalyze, validatePrefill } from "./llm/validate";
import { estimateIdrCost } from "./pricing/pricingCalculator";
import { estimateTokensFromText } from "./pricing/tokenEstimate";
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
const DEFAULT_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const DEFAULT_ALLOWED_ORIGINS = ["https://beta.arnvoid.com"];
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(express.json({ limit: LLM_LIMITS.jsonBodyLimit }));

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
  | "parse_error";

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
}) {
  console.log(JSON.stringify({
    request_id: fields.request_id,
    endpoint: fields.endpoint,
    user_id: fields.user_id,
    model: fields.model,
    input_chars: fields.input_chars,
    output_chars: fields.output_chars,
    duration_ms: fields.duration_ms,
    time_to_first_token_ms: fields.time_to_first_token_ms ?? null,
    status_code: fields.status_code,
    termination_reason: fields.termination_reason,
    rupiah_cost: fields.rupiah_cost ?? null,
    rupiah_balance_before: fields.rupiah_balance_before ?? null,
    rupiah_balance_after: fields.rupiah_balance_after ?? null
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
  if (code === "upstream_error" || statusCode >= 500) return "upstream_error";
  if (statusCode === 200) return "success";
  return "upstream_error";
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
  } | null = null;

  try {
    const pool = await getPool();
    const upsertResult = await pool.query(
      `insert into users (google_sub, email, name, picture)
       values ($1, $2, $3, $4)
       on conflict (google_sub)
       do update set email = excluded.email, name = excluded.name, picture = excluded.picture
       returning id, google_sub, email, name, picture`,
      [user.sub, user.email ?? null, user.name ?? null, user.picture ?? null]
    );
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
      picture: userRow.picture ?? undefined
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
    const result = await pool.query(
      `select sessions.expires_at as expires_at,
              users.google_sub as google_sub,
              users.email as email,
              users.name as name,
              users.picture as picture
       from sessions
       join users on users.id = sessions.user_id
       where sessions.id = $1`,
      [sessionId]
    );

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
        picture: row.picture ?? undefined
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

app.get("/api/rupiah/me", requireAuth, async (req, res) => {
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
  let routerDateKey = "";
  let fxRate = 0;

  const validation = validatePaperAnalyze(req.body);
  if ("ok" in validation && validation.ok === false) {
    sendApiError(res, validation.status, {
      ok: false,
      request_id: requestId,
      code: validation.code,
      error: validation.error
    });
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/paper-analyze",
      user_id: userId,
      model: req.body?.model || "unknown",
      input_chars: typeof req.body?.text === "string" ? req.body.text.length : 0,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: validation.status,
      termination_reason: "validation_error",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    llmRequestsInflight -= 1;
    return;
  }

  if (!acquireLlmSlot(userId)) {
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
    const router = await pickProviderForRequest({ userId, endpointKind: "analyze" });
    const provider = router.provider;
    console.log(`[llm] provider_policy selected=${router.selectedProviderName} actual_provider=${provider.name} cohort=${router.policyMeta.cohort_selected} used_tokens=${router.policyMeta.user_used_tokens_today} pool_remaining=${router.policyMeta.pool_remaining_tokens} cap=${router.policyMeta.user_free_cap} reason=${router.policyMeta.reason} date_key=${router.policyMeta.date_key}`);

    const inputTokensEstimate = estimateTokensFromText(validation.text);
    const fx = await getUsdToIdr();
    fxRate = fx.rate;
    const estimated = estimateIdrCost({
      model: validation.model,
      inputTokens: inputTokensEstimate,
      outputTokens: 0,
      fxRate
    });
    const balanceSnapshot = await getBalance(userId);
    if (balanceSnapshot.balance_idr < estimated.idrCostRounded) {
      const shortfall = estimated.idrCostRounded - balanceSnapshot.balance_idr;
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

    const result = await provider.generateStructuredJson({
      model: validation.model,
      input: validation.text,
      schema: {
        type: "object",
        properties: {
          paper_title: { type: "string" },
          main_points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "integer" },
                title: { type: "string" },
                explanation: { type: "string" }
              },
              required: ["index", "title", "explanation"],
              additionalProperties: false
            },
            minItems: validation.nodeCount,
            maxItems: validation.nodeCount
          },
          links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from_index: { type: "integer" },
                to_index: { type: "integer" },
                type: { type: "string" },
                weight: { type: "number" },
                rationale: { type: "string" }
              },
              required: ["from_index", "to_index", "type", "weight", "rationale"],
              additionalProperties: false
            }
          }
        },
        required: ["paper_title", "main_points", "links"],
        additionalProperties: false
      }
    });

    if (!result.ok) {
      const status = mapLlmErrorToStatus(result);
      sendApiError(res, status, {
        ok: false,
        request_id: requestId,
        code: result.code as ApiErrorCode,
        error: result.error
      });
      logLlmRequest({
        request_id: requestId,
        endpoint: "/api/llm/paper-analyze",
        user_id: userId,
        model: validation.model,
        input_chars: validation.text.length,
        output_chars: 0,
        duration_ms: Date.now() - startedAt,
        status_code: status,
        termination_reason: mapTerminationReason(status, result.code),
        rupiah_cost: null,
        rupiah_balance_before: null,
        rupiah_balance_after: null
      });
      return;
    }

    const outputTextLength = JSON.stringify(result.json || {}).length;
    const usageInput = result.usage?.input_tokens;
    const usageOutput = result.usage?.output_tokens;
    const inputTokens = Number.isFinite(usageInput)
      ? Number(usageInput)
      : estimateTokensFromText(validation.text);
    const outputTokens = Number.isFinite(usageOutput)
      ? Number(usageOutput)
      : estimateTokensFromText(JSON.stringify(result.json || {}));
    const tokensUsed = inputTokens + outputTokens;
    const pricing = estimateIdrCost({
      model: validation.model,
      inputTokens,
      outputTokens,
      fxRate
    });
    const chargeResult = await chargeForLlm({
      userId,
      requestId,
      amountIdr: pricing.idrCostRounded,
      meta: { model: validation.model, totalTokens: pricing.totalTokens }
    });
    if (!chargeResult.ok) {
      const shortfall = pricing.idrCostRounded - chargeResult.balance_idr;
      res.setHeader("X-Request-Id", requestId);
      res.setHeader("X-Request-Id", requestId);
      res.status(402).json({
        ok: false,
        code: "insufficient_rupiah",
        request_id: requestId,
        needed_idr: pricing.idrCostRounded,
        balance_idr: chargeResult.balance_idr,
        shortfall_idr: shortfall
      });
      logLlmRequest({
        request_id: requestId,
        endpoint: "/api/llm/paper-analyze",
        user_id: userId,
        model: validation.model,
        input_chars: validation.text.length,
        output_chars: outputTextLength,
        duration_ms: Date.now() - startedAt,
        status_code: 402,
        termination_reason: "insufficient_rupiah",
        rupiah_cost: pricing.idrCostRounded,
        rupiah_balance_before: chargeResult.balance_idr,
        rupiah_balance_after: chargeResult.balance_idr
      });
      return;
    }

    rupiahCost = pricing.idrCostRounded;
    rupiahBefore = chargeResult.balance_before;
    rupiahAfter = chargeResult.balance_after;

    if (router.selectedProviderName === "openai") {
      try {
        await recordTokenSpend({
          userId,
          dateKey: router.policyMeta.date_key,
          tokensUsed
        });
      } catch {
        // Ignore pool accounting failure.
      }
    }

    res.setHeader("X-Request-Id", requestId);
    res.json({ ok: true, request_id: requestId, json: result.json });
    const outputSize = JSON.stringify(result.json || {}).length;
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/paper-analyze",
      user_id: userId,
      model: validation.model,
      input_chars: validation.text.length,
      output_chars: outputSize,
      duration_ms: Date.now() - startedAt,
      status_code: 200,
      termination_reason: "success",
      rupiah_cost: rupiahCost,
      rupiah_balance_before: rupiahBefore,
      rupiah_balance_after: rupiahAfter
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

    res.json({
      ok: true,
      order_id: orderId,
      status: row.status,
      payment_type: row.payment_type,
      transaction_id: row.midtrans_transaction_id,
      paid_at: row.paid_at || null,
      midtrans_error: statusResult.error
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

  const validation = validatePrefill(req.body);
  if ("ok" in validation && validation.ok === false) {
    sendApiError(res, validation.status, {
      ok: false,
      request_id: requestId,
      code: validation.code,
      error: validation.error
    });
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/prefill",
      user_id: userId,
      model: req.body?.model || "unknown",
      input_chars: typeof req.body?.nodeLabel === "string" ? req.body.nodeLabel.length : 0,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: validation.status,
      termination_reason: "validation_error",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    llmRequestsInflight -= 1;
    return;
  }

  if (!acquireLlmSlot(userId)) {
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
    const router = await pickProviderForRequest({ userId, endpointKind: "prefill" });
    const provider = router.provider;
    console.log(`[llm] provider_policy selected=${router.selectedProviderName} actual_provider=${provider.name} cohort=${router.policyMeta.cohort_selected} used_tokens=${router.policyMeta.user_used_tokens_today} pool_remaining=${router.policyMeta.pool_remaining_tokens} cap=${router.policyMeta.user_free_cap} reason=${router.policyMeta.reason} date_key=${router.policyMeta.date_key}`);

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

    const inputTokensEstimate = estimateTokensFromText(input);
    const fx = await getUsdToIdr();
    fxRate = fx.rate;
    const estimated = estimateIdrCost({
      model: validation.model,
      inputTokens: inputTokensEstimate,
      outputTokens: 0,
      fxRate
    });
    const balanceSnapshot = await getBalance(userId);
    if (balanceSnapshot.balance_idr < estimated.idrCostRounded) {
      const shortfall = estimated.idrCostRounded - balanceSnapshot.balance_idr;
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

    const result = await provider.generateText({
      model: validation.model,
      input
    });

    if (!result.ok) {
      const status = mapLlmErrorToStatus(result);
      sendApiError(res, status, {
        ok: false,
        request_id: requestId,
        code: result.code as ApiErrorCode,
        error: result.error
      });
      logLlmRequest({
        request_id: requestId,
        endpoint: "/api/llm/prefill",
        user_id: userId,
        model: validation.model,
        input_chars: validation.nodeLabel.length,
        output_chars: 0,
        duration_ms: Date.now() - startedAt,
        status_code: status,
        termination_reason: mapTerminationReason(status, result.code),
        rupiah_cost: null,
        rupiah_balance_before: null,
        rupiah_balance_after: null
      });
      return;
    }

    const usageInput = result.usage?.input_tokens;
    const usageOutput = result.usage?.output_tokens;
    const inputTokens = Number.isFinite(usageInput)
      ? Number(usageInput)
      : estimateTokensFromText(input);
    const outputTokens = Number.isFinite(usageOutput)
      ? Number(usageOutput)
      : estimateTokensFromText(result.text);
    const tokensUsed = inputTokens + outputTokens;
    const pricing = estimateIdrCost({
      model: validation.model,
      inputTokens,
      outputTokens,
      fxRate
    });
    const chargeResult = await chargeForLlm({
      userId,
      requestId,
      amountIdr: pricing.idrCostRounded,
      meta: { model: validation.model, totalTokens: pricing.totalTokens }
    });
    if (!chargeResult.ok) {
      const shortfall = pricing.idrCostRounded - chargeResult.balance_idr;
      res.status(402).json({
        ok: false,
        code: "insufficient_rupiah",
        request_id: requestId,
        needed_idr: pricing.idrCostRounded,
        balance_idr: chargeResult.balance_idr,
        shortfall_idr: shortfall
      });
      logLlmRequest({
        request_id: requestId,
        endpoint: "/api/llm/prefill",
        user_id: userId,
        model: validation.model,
        input_chars: validation.nodeLabel.length,
        output_chars: result.text.length,
        duration_ms: Date.now() - startedAt,
        status_code: 402,
        termination_reason: "insufficient_rupiah",
        rupiah_cost: pricing.idrCostRounded,
        rupiah_balance_before: chargeResult.balance_idr,
        rupiah_balance_after: chargeResult.balance_idr
      });
      return;
    }

    rupiahCost = pricing.idrCostRounded;
    rupiahBefore = chargeResult.balance_before;
    rupiahAfter = chargeResult.balance_after;

    if (router.selectedProviderName === "openai") {
      try {
        await recordTokenSpend({
          userId,
          dateKey: router.policyMeta.date_key,
          tokensUsed
        });
      } catch {
        // Ignore pool accounting failure.
      }
    }

    res.setHeader("X-Request-Id", requestId);
    res.json({ ok: true, request_id: requestId, prompt: result.text });
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/prefill",
      user_id: userId,
      model: validation.model,
      input_chars: validation.nodeLabel.length,
      output_chars: result.text.length,
      duration_ms: Date.now() - startedAt,
      status_code: 200,
      termination_reason: "success",
      rupiah_cost: rupiahCost,
      rupiah_balance_before: rupiahBefore,
      rupiah_balance_after: rupiahAfter
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
  let routerDateKey = "";
  let fxRate = 0;

  const validation = validateChat(req.body);
  if ("ok" in validation && validation.ok === false) {
    sendApiError(res, validation.status, {
      ok: false,
      request_id: requestId,
      code: validation.code,
      error: validation.error
    });
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/chat",
      user_id: userId,
      model: req.body?.model || "unknown",
      input_chars: typeof req.body?.userPrompt === "string" ? req.body.userPrompt.length : 0,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: validation.status,
      termination_reason: "validation_error",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    llmRequestsInflight -= 1;
    llmRequestsStreaming -= 1;
    return;
  }

  if (!acquireLlmSlot(userId)) {
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
  let outputText = "";
  let firstTokenAt: number | null = null;
  let terminationReason = "success";
  let chatInput = "";
  req.on("close", () => {
    cancelled = true;
  });

  try {
    const router = await pickProviderForRequest({ userId, endpointKind: "chat" });
    const provider = router.provider;
    routerDateKey = router.policyMeta.date_key;
    console.log(`[llm] provider_policy selected=${router.selectedProviderName} actual_provider=${provider.name} cohort=${router.policyMeta.cohort_selected} used_tokens=${router.policyMeta.user_used_tokens_today} pool_remaining=${router.policyMeta.pool_remaining_tokens} cap=${router.policyMeta.user_free_cap} reason=${router.policyMeta.reason} date_key=${router.policyMeta.date_key}`);

    const systemPrompt = validation.systemPrompt || "";
    chatInput = `${systemPrompt}\n\nUSER PROMPT:\n${validation.userPrompt}`;
    const inputTokensEstimate = estimateTokensFromText(chatInput);
    const fx = await getUsdToIdr();
    fxRate = fx.rate;
    const estimated = estimateIdrCost({
      model: validation.model,
      inputTokens: inputTokensEstimate,
      outputTokens: 0,
      fxRate
    });
    const balanceSnapshot = await getBalance(userId);
    if (balanceSnapshot.balance_idr < estimated.idrCostRounded) {
      const shortfall = estimated.idrCostRounded - balanceSnapshot.balance_idr;
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

    const stream = provider.generateTextStream({
      model: validation.model,
      input: chatInput
    });

    res.setHeader("X-Request-Id", requestId);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    for await (const chunk of stream) {
      if (cancelled) break;
      if (!streamStarted) {
        streamStarted = true;
        firstTokenAt = Date.now();
      }
      outputChars += chunk.length;
      outputText += chunk;
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
    const outputTokensEstimate = estimateTokensFromText(outputText);
    const inputTokensEstimate = estimateTokensFromText(chatInput);
    const tokensUsed = inputTokensEstimate + outputTokensEstimate;
    const pricing = estimateIdrCost({
      model: validation.model,
      inputTokens: inputTokensEstimate,
      outputTokens: outputTokensEstimate,
      fxRate
    });
    const chargeResult = await chargeForLlm({
      userId,
      requestId,
      amountIdr: pricing.idrCostRounded,
      meta: { model: validation.model, totalTokens: pricing.totalTokens }
    });
    if (chargeResult.ok) {
      rupiahCost = pricing.idrCostRounded;
      rupiahBefore = chargeResult.balance_before;
      rupiahAfter = chargeResult.balance_after;
    } else {
      terminationReason = "insufficient_rupiah";
    }

    if (provider.name === "openai" && routerDateKey) {
      try {
        await recordTokenSpend({
          userId,
          dateKey: routerDateKey,
          tokensUsed
        });
      } catch {
        // Ignore pool accounting failure.
      }
    }

    releaseLlmSlot(userId);
    llmRequestsInflight -= 1;
    llmRequestsStreaming -= 1;
    logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/chat",
      user_id: userId,
      model: validation.model,
      input_chars: validation.userPrompt.length,
      output_chars: outputChars,
      duration_ms: Date.now() - startedAt,
      time_to_first_token_ms: firstTokenAt ? firstTokenAt - startedAt : null,
      status_code: statusCode,
      termination_reason: terminationReason,
      rupiah_cost: rupiahCost,
      rupiah_balance_before: rupiahBefore,
      rupiah_balance_after: rupiahAfter
    });
  }
});

app.listen(port, () => {
  console.log(`[server] listening on ${port}`);
});
