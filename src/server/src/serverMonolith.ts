import cors from "cors";
import express from "express";
import { makeVerifyGoogleIdToken } from "./auth/googleToken";
import { makeRequireAuth, type AuthContext } from "./auth/requireAuth";
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
import {
  parseGrossAmount,
  sanitizeActions,
  isPaidStatus,
  verifyMidtransSignature
} from "./payments/midtransUtils";
import { registerPaymentsWebhookRoute } from "./routes/paymentsWebhookRoute";
import { registerHealthRoutes } from "./routes/healthRoutes";
import { registerAuthRoutes } from "./routes/authRoutes";
import { registerProfileRoutes } from "./routes/profileRoutes";
import { registerSavedInterfacesRoutes } from "./routes/savedInterfacesRoutes";
import { buildCorsOptions } from "./server/corsConfig";
import { buildRouteDeps } from "./server/depsBuilder";
import { loadServerEnvConfig } from "./server/envConfig";
import { applyJsonParsers } from "./server/jsonParsers";
import { runStartupGates } from "./server/startupGates";

const app = express();
app.set("trust proxy", 1);
const serverEnv = loadServerEnvConfig();
const port = serverEnv.port;

const SAVED_INTERFACE_JSON_LIMIT = serverEnv.savedInterfaceJsonLimit;
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

function isDevBalanceBypassEnabled() {
  return serverEnv.devBypassBalanceEnabled;
}

const verifyGoogleIdToken = makeVerifyGoogleIdToken();
const requireAuth = makeRequireAuth({
  getPool,
  cookieName: serverEnv.cookieName,
  cookieSameSite: serverEnv.cookieSameSite,
  isProd: serverEnv.isProd
});

const llmRuntime = createLlmRuntimeState({ maxConcurrentLlm: 2 });
llmRuntime.startPeriodicLog(60000);

function getUserId(user: AuthContext): string {
  return String(user.id);
}

function isValidationError(value: unknown): value is ValidationError {
  return Boolean(value) && typeof value === "object" && (value as ValidationError).ok === false;
}

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

const routeDeps = buildRouteDeps({
  cfg: serverEnv,
  services: {
    getPool,
    requireAuth,
    verifyGoogleIdToken,
    getBalance,
    midtransRequest,
    parseGrossAmount,
    applyTopupFromMidtrans,
    sanitizeActions,
    isPaidStatus,
    verifyMidtransSignature,
    llmCommon: llmRouteCommonDeps,
    llmStreaming: {
      incRequestsStreaming: llmRuntime.incRequestsStreaming,
      decRequestsStreaming: llmRuntime.decRequestsStreaming
    },
    logger: console
  },
  getProfileColumnsAvailable: () => profileColumnsAvailable
});

registerPaymentsWebhookRoute(app, routeDeps.paymentsWebhook);

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

registerHealthRoutes(app, routeDeps.health);

registerAuthRoutes(app, routeDeps.auth);

registerProfileRoutes(app, routeDeps.profile);

registerSavedInterfacesRoutes(app, routeDeps.savedInterfaces);

registerRupiahAndPaymentsCreateRoutes(app, routeDeps.payments);

registerLlmAnalyzeRoute(app, routeDeps.llmAnalyze);

registerPaymentsStatusRoute(app, routeDeps.payments);

registerLlmPrefillRoute(app, routeDeps.llmPrefill);
registerLlmChatRoute(app, routeDeps.llmChat);

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
