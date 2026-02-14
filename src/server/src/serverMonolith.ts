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
import {
  registerPaymentsStatusRoute,
  registerRupiahAndPaymentsCreateRoutes
} from "./routes/paymentsRoutes";
import { registerPaymentsWebhookRoute } from "./routes/paymentsWebhookRoute";
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

registerPaymentsWebhookRoute(app, {
  getPool,
  verifyMidtransSignature,
  applyTopupFromMidtrans,
  isPaidStatus
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

const paymentsRouteDeps = {
  getPool,
  requireAuth,
  getBalance,
  midtransRequest,
  parseGrossAmount,
  applyTopupFromMidtrans,
  sanitizeActions,
  isPaidStatus
};

registerRupiahAndPaymentsCreateRoutes(app, paymentsRouteDeps);

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

registerPaymentsStatusRoute(app, paymentsRouteDeps);

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
