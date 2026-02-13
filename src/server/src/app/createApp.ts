import cors from "cors";
import express from "express";
import { LLM_LIMITS } from "../llm/limits";
import {
  DEFAULT_ALLOWED_ORIGINS,
  DEFAULT_DEV_ORIGINS,
  FEEDBACK_CATEGORY_MAX_CHARS,
  FEEDBACK_MESSAGE_MAX_CHARS,
  isProd,
  SAVED_INTERFACE_JSON_LIMIT,
} from "./deps";
import { parseAdminAllowlist, readAdminAllowlistRaw } from "../lib/adminAllowlist";
import { registerFeedbackRoutes } from "../routes/feedbackRoutes";
import { getPool } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { registerAuthRoutes } from "../routes/authRoutes";
import { registerProfileRoutes } from "../routes/profileRoutes";
import { registerSavedInterfacesRoutes } from "../routes/savedInterfacesRoutes";
import { registerPaymentsRoutes } from "../routes/paymentsRoutes";
import { registerLlmAnalyzePrefillRoutes } from "../routes/llmAnalyzePrefillRoutes";
import { registerLlmChatRoutes } from "../routes/llmChatRoutes";

export function createApp(getProfileColumnsAvailable: () => boolean) {
  const app = express();
  app.set("trust proxy", 1);

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
    allowedOrigins.length > 0 ? allowedOrigins : [...DEFAULT_ALLOWED_ORIGINS, ...DEFAULT_DEV_ORIGINS];
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
        cb(null, true);
        return;
      }
      cb(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));

  app.get("/health", (_req, res) => {
    const hasDatabaseUrl = (process.env.DATABASE_URL || "").trim().length > 0;
    const hasConnectorEnv = (process.env.INSTANCE_CONNECTION_NAME || "").trim().length > 0;
    res.status(200).json({
      ok: true,
      server: "up",
      dbConfig: hasDatabaseUrl ? "database_url" : hasConnectorEnv ? "cloud_sql_connector" : "missing",
    });
  });

  registerAuthRoutes(app, getProfileColumnsAvailable);
  registerProfileRoutes(app, getProfileColumnsAvailable);
  registerSavedInterfacesRoutes(app);
  registerPaymentsRoutes(app);
  registerLlmAnalyzePrefillRoutes(app);
  registerLlmChatRoutes(app);

  const adminAllowlist = parseAdminAllowlist(readAdminAllowlistRaw(process.env));
  const feedbackRouteRegistration = registerFeedbackRoutes(app, {
    requireAuth,
    getPool,
    adminAllowlist,
    categoryMaxChars: FEEDBACK_CATEGORY_MAX_CHARS,
    messageMaxChars: FEEDBACK_MESSAGE_MAX_CHARS,
  });

  return { app, adminAllowlist, feedbackRouteRegistration };
}
