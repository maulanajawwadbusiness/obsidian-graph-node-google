const DEV_PORTS = [5173, 5174, 5175, 5176, 5177, 5178];
const DEFAULT_ALLOWED_ORIGINS = ["https://beta.arnvoid.com"];
const COOKIE_SAMESITE = "lax";

export type ServerEnvConfig = {
  port: number;
  cookieName: string;
  sessionTtlMs: number;
  cookieSameSite: string;
  devPorts: number[];
  defaultDevOrigins: string[];
  defaultAllowedOrigins: string[];
  allowedOriginsRaw: string[];
  corsAllowedOrigins: string[];
  savedInterfacesListLimit: number;
  maxSavedInterfacePayloadBytes: number;
  savedInterfaceJsonLimit: string;
  isProd: boolean;
  devBypassBalanceEnabled: boolean;
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
    devPorts: DEV_PORTS,
    defaultDevOrigins,
    defaultAllowedOrigins: DEFAULT_ALLOWED_ORIGINS,
    allowedOriginsRaw,
    corsAllowedOrigins,
    savedInterfacesListLimit: 20,
    maxSavedInterfacePayloadBytes: Number(
      process.env.MAX_SAVED_INTERFACE_PAYLOAD_BYTES || 15 * 1024 * 1024
    ),
    savedInterfaceJsonLimit: process.env.SAVED_INTERFACE_JSON_LIMIT || "15mb",
    isProd,
    devBypassBalanceEnabled: !isProd && process.env.DEV_BYPASS_BALANCE === "1",
    shouldWarnMissingAllowedOriginsInProd: isProd && allowedOriginsRaw.length === 0,
    isOpenrouterAnalyzeAllowed
  };
}
