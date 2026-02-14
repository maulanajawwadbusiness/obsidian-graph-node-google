import crypto from "crypto";
import cors from "cors";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { getPool } from "./db";
import { midtransRequest } from "./midtrans/client";
import { assertAuthSchemaReady } from "./authSchemaGuard";
import { LLM_LIMITS } from "./llm/limits";
import { createLlmRuntimeState } from "./llm/runtimeState";
import {
  getPriceUsdPerM,
  getUsageFieldList,
  logLlmRequest,
  mapLlmErrorToStatus,
  mapTerminationReason,
  sendApiError
} from "./llm/requestFlow";
import { type ValidationError } from "./llm/validate";
import { applyTopupFromMidtrans, getBalance } from "./rupiah/rupiahService";
import { registerLlmAnalyzeRoute } from "./routes/llmAnalyzeRoute";
import { registerLlmPrefillRoute } from "./routes/llmPrefillRoute";
import { registerLlmChatRoute } from "./routes/llmChatRoute";
import { registerHealthRoutes } from "./routes/healthRoutes";
import { registerAuthRoutes } from "./routes/authRoutes";
import { registerProfileRoutes } from "./routes/profileRoutes";
import { registerSavedInterfacesRoutes } from "./routes/savedInterfacesRoutes";
import { clearSessionCookie, getSessionIdFromRequest } from "./server/cookies";
import { buildCorsOptions } from "./server/corsConfig";
import { loadServerEnvConfig } from "./server/envConfig";
import { applyJsonParsers } from "./server/jsonParsers";
import { runStartupGates } from "./server/startupGates";
import type {
  LlmAnalyzeRouteDeps,
  LlmPrefillRouteDeps,
  LlmChatRouteDeps
} from "./routes/llmRouteDeps";

type AuthContext = {
  id: string;
  google_sub: string;
  email?: string | null;
};

const app = express();
app.set("trust proxy", 1);
const serverEnv = loadServerEnvConfig();
const port = serverEnv.port;

const COOKIE_NAME = serverEnv.cookieName;
const SESSION_TTL_MS = serverEnv.sessionTtlMs;
const COOKIE_SAMESITE = serverEnv.cookieSameSite;
const SAVED_INTERFACES_LIST_LIMIT = serverEnv.savedInterfacesListLimit;
const MAX_SAVED_INTERFACE_PAYLOAD_BYTES = serverEnv.maxSavedInterfacePayloadBytes;
const SAVED_INTERFACE_JSON_LIMIT = serverEnv.savedInterfaceJsonLimit;
const PROFILE_DISPLAY_NAME_MAX = 80;
const PROFILE_USERNAME_MAX = 32;
const PROFILE_USERNAME_REGEX = /^[A-Za-z0-9_.-]+$/;
let profileColumnsAvailable = false;
applyJsonParsers(app, {
  savedInterfacesJsonLimit: SAVED_INTERFACE_JSON_LIMIT,
  globalJsonLimit: LLM_LIMITS.jsonBodyLimit
});

const corsAllowedOrigins = serverEnv.corsAllowedOrigins;
if (serverEnv.shouldWarnMissingAllowedOriginsInProd) {
  console.warn("[cors] ALLOWED_ORIGINS not set in prod; CORS will block real frontend");
}
const corsOptions = buildCorsOptions({ allowedOrigins: corsAllowedOrigins });

function isProd() {
  return serverEnv.isProd;
}

function isDevBalanceBypassEnabled() {
  return serverEnv.devBypassBalanceEnabled;
}

async function verifyGoogleIdToken(args: {
  idToken: string;
  audience: string;
}): Promise<{ sub?: string; email?: string; name?: string; picture?: string }> {
  const oauthClient = new OAuth2Client(args.audience);
  const ticket = await oauthClient.verifyIdToken({
    idToken: args.idToken,
    audience: args.audience
  });
  const payload = ticket.getPayload();
  return {
    sub: payload?.sub,
    email: payload?.email ?? undefined,
    name: payload?.name ?? undefined,
    picture: payload?.picture ?? undefined
  };
}

function parseGrossAmount(value: unknown, fallbackAmount: number): number | null {
  if (value === undefined || value === null) return fallbackAmount;
  const amount = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.trunc(amount);
  if (rounded <= 0) return null;
  return rounded;
}

const llmRuntime = createLlmRuntimeState({ maxConcurrentLlm: 2 });
llmRuntime.startPeriodicLog(60000);

function getUserId(user: AuthContext): string {
  return String(user.id);
}

function isValidationError(value: unknown): value is ValidationError {
  return Boolean(value) && typeof value === "object" && (value as ValidationError).ok === false;
}

function isOpenrouterAnalyzeAllowed(model: string): boolean {
  return serverEnv.isOpenrouterAnalyzeAllowed(model);
}

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
  const sessionId = getSessionIdFromRequest(req, { cookieName: COOKIE_NAME });
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
      clearSessionCookie(res, {
        cookieName: COOKIE_NAME,
        cookieSameSite: COOKIE_SAMESITE,
        isProd: isProd()
      });
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

registerHealthRoutes(app, { getPool });

registerAuthRoutes(app, {
  getPool,
  cookieName: COOKIE_NAME,
  cookieSameSite: COOKIE_SAMESITE,
  cookieTtlMs: SESSION_TTL_MS,
  isProd: isProd(),
  getProfileColumnsAvailable: () => profileColumnsAvailable,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  verifyGoogleIdToken
});

registerProfileRoutes(app, {
  getPool,
  requireAuth,
  getProfileColumnsAvailable: () => profileColumnsAvailable,
  profileDisplayNameMax: PROFILE_DISPLAY_NAME_MAX,
  profileUsernameMax: PROFILE_USERNAME_MAX,
  profileUsernameRegex: PROFILE_USERNAME_REGEX
});

registerSavedInterfacesRoutes(app, {
  getPool,
  requireAuth,
  listLimit: SAVED_INTERFACES_LIST_LIMIT,
  maxPayloadBytes: MAX_SAVED_INTERFACE_PAYLOAD_BYTES,
  logger: console
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
  acquireLlmSlot: llmRuntime.acquireLlmSlot,
  releaseLlmSlot: llmRuntime.releaseLlmSlot,
  sendApiError,
  isValidationError,
  logLlmRequest,
  mapLlmErrorToStatus,
  mapTerminationReason,
  getUsageFieldList,
  getPriceUsdPerM,
  isDevBalanceBypassEnabled,
  incRequestsTotal: llmRuntime.incRequestsTotal,
  incRequestsInflight: llmRuntime.incRequestsInflight,
  decRequestsInflight: llmRuntime.decRequestsInflight
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
  incRequestsStreaming: llmRuntime.incRequestsStreaming,
  decRequestsStreaming: llmRuntime.decRequestsStreaming
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
    const startup = await runStartupGates({
      assertAuthSchemaReady,
      getPool,
      logger: console
    });
    profileColumnsAvailable = startup.profileColumnsAvailable;
    app.listen(port, () => {
      console.log(`[server] listening on ${port}`);
    });
  } catch (error) {
    console.error(`[auth-schema] fatal startup failure: ${String(error)}`);
    process.exit(1);
  }
}

void startServer();
