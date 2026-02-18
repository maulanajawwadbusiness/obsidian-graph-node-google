const DEV_PORTS = [5173, 5174, 5175, 5176, 5177, 5178];
const DEFAULT_ALLOWED_ORIGINS = ["https://beta.arnvoid.com"];
const COOKIE_SAMESITE = "lax";

// Env ownership boundary:
// - loadServerEnvConfig() owns bootstrap/server wiring env values only
//   (port, cookie/session, cors, saved-interface limits, analyze provider flags).
// - Domain modules keep domain-specific env reads local (db, llm providers,
//   midtrans transport, fx, and selftest/smoke scripts) to avoid coupling all
//   runtime concerns into one server bootstrap config object.
export type ServerEnvConfig = {
  port: number;
  cookieName: string;
  sessionTtlMs: number;
  cookieSameSite: string;
  googleClientId?: string;
  midtransServerKey: string;
  corsAllowedOrigins: string[];
  savedInterfacesListLimit: number;
  maxSavedInterfacePayloadBytes: number;
  savedInterfaceJsonLimit: string;
  isProd: boolean;
  devBypassBalanceEnabled: boolean;
  betaFreeModeEnabled: boolean;
  betaCapsModeEnabled: boolean;
  shouldWarnMissingAllowedOriginsInProd: boolean;
  isOpenrouterAnalyzeAllowed: (model: string) => boolean;
};

export function loadServerEnvConfig(): ServerEnvConfig {
  const isProd = Boolean(process.env.K_SERVICE) || process.env.NODE_ENV === "production";
  const allowedOriginsRaw = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const defaultDevOrigins = DEV_PORTS.flatMap((port) => [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`
  ]);
  const corsAllowedOrigins =
    allowedOriginsRaw.length > 0
      ? allowedOriginsRaw
      : [...DEFAULT_ALLOWED_ORIGINS, ...defaultDevOrigins];

  const allowOpenrouterAnalyze = process.env.ALLOW_OPENROUTER_ANALYZE === "true";
  const openrouterAnalyzeModels = new Set(
    (process.env.OPENROUTER_ANALYZE_MODELS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const isOpenrouterAnalyzeAllowed = (model: string) => {
    if (!allowOpenrouterAnalyze) return false;
    if (openrouterAnalyzeModels.size === 0) return false;
    return openrouterAnalyzeModels.has(model);
  };

  return {
    port: Number(process.env.PORT || 8080),
    cookieName: process.env.SESSION_COOKIE_NAME || "arnvoid_session",
    sessionTtlMs: Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7),
    cookieSameSite: COOKIE_SAMESITE,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    midtransServerKey: process.env.MIDTRANS_SERVER_KEY || "",
    corsAllowedOrigins,
    savedInterfacesListLimit: 20,
    maxSavedInterfacePayloadBytes: Number(
      process.env.MAX_SAVED_INTERFACE_PAYLOAD_BYTES || 15 * 1024 * 1024
    ),
    savedInterfaceJsonLimit: process.env.SAVED_INTERFACE_JSON_LIMIT || "15mb",
    isProd,
    devBypassBalanceEnabled: !isProd && process.env.DEV_BYPASS_BALANCE === "1",
    betaFreeModeEnabled: process.env.BETA_FREE_MODE === "1",
    betaCapsModeEnabled: process.env.BETA_CAPS_MODE === "1",
    shouldWarnMissingAllowedOriginsInProd: isProd && allowedOriginsRaw.length === 0,
    isOpenrouterAnalyzeAllowed
  };
}
