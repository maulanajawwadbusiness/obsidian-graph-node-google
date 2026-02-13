import express from "express";
import { isAdminEmail } from "../lib/adminAllowlist";

type AuthContext = {
  id: string;
  google_sub: string;
  email?: string | null;
};

type FeedbackStatus = "new" | "triaged" | "done";

type RegisterFeedbackRoutesDeps = {
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>;
  getPool: () => Promise<any>;
  adminAllowlist: Set<string>;
  categoryMaxChars: number;
  messageMaxChars: number;
};

function normalizeFeedbackCategory(raw: unknown, maxChars: number): string | null {
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length > maxChars) return null;
  return trimmed;
}

function normalizeFeedbackMessage(raw: unknown, maxChars: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxChars) return null;
  return trimmed;
}

function normalizeFeedbackStatus(raw: unknown): FeedbackStatus | null {
  if (raw !== "new" && raw !== "triaged" && raw !== "done") return null;
  return raw;
}

function requireFeedbackAdminOrSendForbidden(
  res: express.Response,
  adminAllowlist: Set<string>
): AuthContext | null {
  const auth = res.locals.user as AuthContext | undefined;
  if (!isAdminEmail(adminAllowlist, auth?.email)) {
    res.status(403).json({ error: "forbidden" });
    return null;
  }
  return auth ?? null;
}

export function registerFeedbackRoutes(app: express.Express, deps: RegisterFeedbackRoutesDeps) {
  app.post("/api/feedback", deps.requireAuth, async (req, res) => {
    const auth = res.locals.user as AuthContext | undefined;
    if (!auth?.id) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const category = normalizeFeedbackCategory(req.body?.category, deps.categoryMaxChars);
    const message = normalizeFeedbackMessage(req.body?.message, deps.messageMaxChars);
    const contextJson = req.body?.contextJson ?? null;

    if (category === null || message === null) {
      res.status(400).json({ ok: false, error: "invalid payload" });
      return;
    }

    let contextPayload: string | null = null;
    if (contextJson !== null && contextJson !== undefined) {
      try {
        contextPayload = JSON.stringify(contextJson);
      } catch {
        res.status(400).json({ ok: false, error: "invalid contextJson" });
        return;
      }
    }

    try {
      const pool = await deps.getPool();
      const result = await pool.query(
        `insert into feedback_messages (user_id, category, message, context_json, status)
         values ($1, $2, $3, $4::jsonb, 'new')
         returning id, status, created_at`,
        [auth.id, category || null, message, contextPayload]
      );
      const row = result.rows[0];
      if (!row) {
        res.status(500).json({ ok: false, error: "failed to submit feedback" });
        return;
      }
      console.log(
        "[feedback] submit ok user=%s id=%s cat=%s len=%s ctxBytes=%s",
        auth.id,
        row.id,
        category || "",
        message.length,
        contextPayload ? contextPayload.length : 0
      );
      res.status(200).json({ ok: true, item: { id: String(row.id), status: String(row.status), createdAt: String(row.created_at) } });
    } catch (e) {
      console.error("[feedback] submit failed", e);
      res.status(500).json({ ok: false, error: "failed to submit feedback" });
    }
  });

  app.get("/api/feedback", deps.requireAuth, async (req, res) => {
    const auth = requireFeedbackAdminOrSendForbidden(res, deps.adminAllowlist);
    if (!auth) return;

    const rawLimit = Number(req.query?.limit ?? 20);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.trunc(rawLimit))) : 20;
    const beforeIdRaw = req.query?.beforeId;
    const beforeId = typeof beforeIdRaw === "string" && beforeIdRaw.trim().length > 0 ? beforeIdRaw.trim() : null;

    try {
      const pool = await deps.getPool();
      const result = await pool.query(
        `select id, user_id, category, message, context_json, status, created_at, updated_at
         from feedback_messages
         where ($1::bigint is null or id < $1::bigint)
         order by id desc
         limit $2`,
        [beforeId, limit]
      );
      const items = result.rows.map((row: any) => ({
        id: String(row.id),
        userId: String(row.user_id),
        category: row.category ? String(row.category) : "",
        message: String(row.message),
        contextJson: row.context_json ?? null,
        status: String(row.status),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }));
      console.log("[feedback] admin_list ok n=%s beforeId=%s", items.length, beforeId ?? "null");
      res.status(200).json({ ok: true, items });
    } catch (e) {
      console.error("[feedback] admin_list failed", e);
      res.status(500).json({ ok: false, error: "failed to list feedback" });
    }
  });

  app.post("/api/feedback/update-status", deps.requireAuth, async (req, res) => {
    const auth = requireFeedbackAdminOrSendForbidden(res, deps.adminAllowlist);
    if (!auth) return;

    const idRaw = req.body?.id;
    const id = typeof idRaw === "string" && idRaw.trim() ? idRaw.trim() : String(idRaw ?? "").trim();
    const status = normalizeFeedbackStatus(req.body?.status);
    if (!id || !status) {
      res.status(400).json({ ok: false, error: "invalid payload" });
      return;
    }

    try {
      const pool = await deps.getPool();
      const result = await pool.query(
        `update feedback_messages
            set status = $2, updated_at = now()
          where id = $1::bigint
        returning id, status, updated_at`,
        [id, status]
      );
      const updated = result.rows[0] || null;
      console.log("[feedback] admin_status ok id=%s status=%s updated=%s", id, status, updated ? "yes" : "no");
      res.status(200).json({ ok: true, item: updated });
    } catch (e) {
      console.error("[feedback] admin_status failed", e);
      res.status(500).json({ ok: false, error: "failed to update feedback status" });
    }
  });

  return {
    submit: true,
    list: true,
    updateStatus: true,
  };
}
