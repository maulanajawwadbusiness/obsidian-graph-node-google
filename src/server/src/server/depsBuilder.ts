import type express from "express";
import type { ServerEnvConfig } from "./envConfig";
import type { HealthRouteDeps } from "../routes/healthRoutes";
import type { AuthRouteDeps } from "../routes/authRoutes";
import type { ProfileRouteDeps } from "../routes/profileRoutes";
import type { SavedInterfacesRouteDeps } from "../routes/savedInterfacesRoutes";
import type { PaymentsRouteDeps } from "../routes/paymentsRoutes";
import type { PaymentsWebhookDeps } from "../routes/paymentsWebhookRoute";
import type { BetaCapsRouteDeps } from "../routes/betaCapsRoutes";
import type {
  LlmAnalyzeRouteDeps,
  LlmPrefillRouteDeps,
  LlmChatRouteDeps
} from "../routes/llmRouteDeps";

export type CoreServices = {
  getPool: () => Promise<{
    query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }>;
    connect: () => Promise<{
      query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }>;
      release: () => void;
    }>;
  }>;
  requireAuth: express.RequestHandler;
  verifyGoogleIdToken: AuthRouteDeps["verifyGoogleIdToken"];
  getBalance: PaymentsRouteDeps["getBalance"];
  midtransRequest: PaymentsRouteDeps["midtransRequest"];
  parseGrossAmount: PaymentsRouteDeps["parseGrossAmount"];
  applyTopupFromMidtrans: PaymentsRouteDeps["applyTopupFromMidtrans"];
  sanitizeActions: PaymentsRouteDeps["sanitizeActions"];
  isPaidStatus: PaymentsRouteDeps["isPaidStatus"];
  verifyMidtransSignature: (payload: unknown, serverKey: string) => boolean;
  llmCommon: LlmPrefillRouteDeps;
  llmStreaming: Pick<LlmChatRouteDeps, "incRequestsStreaming" | "decRequestsStreaming">;
  logger?: Pick<Console, "log" | "warn" | "error">;
};

export type BuiltRouteDeps = {
  health: HealthRouteDeps;
  auth: AuthRouteDeps;
  profile: ProfileRouteDeps;
  savedInterfaces: SavedInterfacesRouteDeps;
  payments: PaymentsRouteDeps;
  paymentsWebhook: PaymentsWebhookDeps;
  betaCaps: BetaCapsRouteDeps;
  llmAnalyze: LlmAnalyzeRouteDeps;
  llmPrefill: LlmPrefillRouteDeps;
  llmChat: LlmChatRouteDeps;
};

export function buildRouteDeps(args: {
  cfg: ServerEnvConfig;
  services: CoreServices;
  getProfileColumnsAvailable: () => boolean;
}): BuiltRouteDeps {
  const { cfg, services, getProfileColumnsAvailable } = args;
  const logger = services.logger ?? console;

  const health: HealthRouteDeps = {
    getPool: services.getPool
  };

  const auth: AuthRouteDeps = {
    getPool: services.getPool,
    cookieName: cfg.cookieName,
    cookieSameSite: cfg.cookieSameSite,
    cookieTtlMs: cfg.sessionTtlMs,
    isProd: cfg.isProd,
    getProfileColumnsAvailable,
    googleClientId: cfg.googleClientId,
    verifyGoogleIdToken: services.verifyGoogleIdToken
  };

  const profile: ProfileRouteDeps = {
    getPool: services.getPool,
    requireAuth: services.requireAuth,
    getProfileColumnsAvailable,
    profileDisplayNameMax: 80,
    profileUsernameMax: 32,
    profileUsernameRegex: /^[A-Za-z0-9_.-]+$/
  };

  const savedInterfaces: SavedInterfacesRouteDeps = {
    getPool: services.getPool,
    requireAuth: services.requireAuth,
    listLimit: cfg.savedInterfacesListLimit,
    maxPayloadBytes: cfg.maxSavedInterfacePayloadBytes,
    logger
  };

  const payments: PaymentsRouteDeps = {
    getPool: services.getPool,
    requireAuth: services.requireAuth,
    getBalance: services.getBalance,
    midtransRequest: services.midtransRequest,
    parseGrossAmount: services.parseGrossAmount,
    applyTopupFromMidtrans: services.applyTopupFromMidtrans,
    sanitizeActions: services.sanitizeActions,
    isPaidStatus: services.isPaidStatus
  };

  const paymentsWebhook: PaymentsWebhookDeps = {
    getPool: services.getPool,
    verifyMidtransSignature: (payload: unknown) =>
      services.verifyMidtransSignature(payload, cfg.midtransServerKey),
    applyTopupFromMidtrans: services.applyTopupFromMidtrans,
    isPaidStatus: services.isPaidStatus
  };

  const betaCaps: BetaCapsRouteDeps = {
    getPool: services.getPool,
    requireAuth: services.requireAuth,
    getUserId: services.llmCommon.getUserId,
    isBetaCapsModeEnabled: services.llmCommon.isBetaCapsModeEnabled
  };

  const llmPrefill: LlmPrefillRouteDeps = {
    ...services.llmCommon
  };

  const llmAnalyze: LlmAnalyzeRouteDeps = {
    ...services.llmCommon,
    isOpenrouterAnalyzeAllowed: cfg.isOpenrouterAnalyzeAllowed
  };

  const llmChat: LlmChatRouteDeps = {
    ...services.llmCommon,
    ...services.llmStreaming
  };

  return {
    health,
    auth,
    profile,
    savedInterfaces,
    payments,
    paymentsWebhook,
    betaCaps,
    llmAnalyze,
    llmPrefill,
    llmChat
  };
}
