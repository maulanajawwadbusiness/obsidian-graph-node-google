/* eslint-disable no-console */

import depsBuilderModule from "../dist/server/depsBuilder.js";

const { buildRouteDeps } = depsBuilderModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const cfg = {
    port: 8080,
    cookieName: "arnvoid_session",
    sessionTtlMs: 604800000,
    cookieSameSite: "lax",
    googleClientId: "test-google-client",
    midtransServerKey: "test-midtrans-key",
    devPorts: [5173, 5174, 5175, 5176, 5177, 5178],
    defaultDevOrigins: [],
    defaultAllowedOrigins: ["https://beta.arnvoid.com"],
    allowedOriginsRaw: [],
    corsAllowedOrigins: ["https://beta.arnvoid.com"],
    savedInterfacesListLimit: 20,
    maxSavedInterfacePayloadBytes: 15728640,
    savedInterfaceJsonLimit: "15mb",
    isProd: false,
    devBypassBalanceEnabled: true,
    shouldWarnMissingAllowedOriginsInProd: false,
    isOpenrouterAnalyzeAllowed: (_model) => false
  };

  const services = {
    getPool: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => ({
        query: async () => ({ rows: [], rowCount: 0 }),
        release: () => {
          // no-op
        }
      })
    }),
    requireAuth: (_req, _res, next) => next(),
    verifyGoogleIdToken: async (_args) => ({ sub: "sub-1" }),
    getBalance: async (_userId) => ({ balance_idr: 0, updated_at: new Date().toISOString() }),
    midtransRequest: async (_path, _init) => ({ ok: true, data: {} }),
    parseGrossAmount: (_value, fallback) => fallback,
    applyTopupFromMidtrans: async (_args) => {
      // no-op
    },
    sanitizeActions: (_value) => [],
    isPaidStatus: (status) => status === "settlement" || status === "capture",
    verifyMidtransSignature: (_payload, serverKey) => Boolean(serverKey),
    llmCommon: {
      requireAuth: (_req, _res, next) => next(),
      getUserId: (user) => String(user.id),
      acquireLlmSlot: (_userId) => true,
      releaseLlmSlot: (_userId) => {
        // no-op
      },
      sendApiError: (res, status, body, opts) => {
        if (opts?.headers) {
          for (const [name, value] of Object.entries(opts.headers)) {
            res.setHeader(name, value);
          }
        }
        res.status(status).json(body);
      },
      isValidationError: (_value) => false,
      logLlmRequest: (_fields) => {
        // no-op
      },
      mapLlmErrorToStatus: (_error) => 500,
      mapTerminationReason: (statusCode, _code) => String(statusCode),
      getUsageFieldList: (_usage) => [],
      getPriceUsdPerM: (_model) => null,
      isDevBalanceBypassEnabled: () => false,
      incRequestsTotal: () => {
        // no-op
      },
      incRequestsInflight: () => {
        // no-op
      },
      decRequestsInflight: () => {
        // no-op
      }
    },
    llmStreaming: {
      incRequestsStreaming: () => {
        // no-op
      },
      decRequestsStreaming: () => {
        // no-op
      }
    },
    logger: console
  };

  const routeDeps = buildRouteDeps({
    cfg,
    services,
    getProfileColumnsAvailable: () => true
  });

  assert(routeDeps && typeof routeDeps === "object", "routeDeps must be object");
  assert(typeof routeDeps.health?.getPool === "function", "health.getPool missing");
  assert(typeof routeDeps.auth?.verifyGoogleIdToken === "function", "auth.verifyGoogleIdToken missing");
  assert(typeof routeDeps.profile?.requireAuth === "function", "profile.requireAuth missing");
  assert(typeof routeDeps.savedInterfaces?.requireAuth === "function", "savedInterfaces.requireAuth missing");
  assert(typeof routeDeps.payments?.midtransRequest === "function", "payments.midtransRequest missing");
  assert(
    typeof routeDeps.paymentsWebhook?.verifyMidtransSignature === "function",
    "paymentsWebhook.verifyMidtransSignature missing"
  );
  assert(
    typeof routeDeps.llmAnalyze?.isOpenrouterAnalyzeAllowed === "function",
    "llmAnalyze.isOpenrouterAnalyzeAllowed missing"
  );
  assert(typeof routeDeps.llmPrefill?.sendApiError === "function", "llmPrefill.sendApiError missing");
  assert(typeof routeDeps.llmChat?.incRequestsStreaming === "function", "llmChat.incRequestsStreaming missing");

  assert(routeDeps.auth.googleClientId === "test-google-client", "auth.googleClientId should match cfg");
  assert(routeDeps.auth.cookieName === "arnvoid_session", "auth.cookieName should match cfg");

  const midtransVerified = routeDeps.paymentsWebhook.verifyMidtransSignature({ order_id: "x" });
  assert(midtransVerified === true, "paymentsWebhook signature verifier should close over cfg key");

  console.log("[depsbuilder-contracts] deps shape contract ok");
  console.log("[depsbuilder-contracts] cfg wiring contract ok");
  console.log("[depsbuilder-contracts] done");
}

run().catch((error) => {
  console.error(`[depsbuilder-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
