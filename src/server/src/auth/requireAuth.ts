import type express from "express";
import { clearSessionCookie, getSessionIdFromRequest } from "../server/cookies";

export type AuthContext = {
  id: string;
  google_sub: string;
  email?: string | null;
};

type QueryResult = {
  rows: any[];
};

type QueryablePool = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
};

export function makeRequireAuth(args: {
  getPool: () => Promise<QueryablePool>;
  cookieName: string;
  cookieSameSite: string;
  isProd: boolean;
}): express.RequestHandler {
  return async function requireAuth(req, res, next) {
    const sessionId = getSessionIdFromRequest(req, { cookieName: args.cookieName });
    if (!sessionId) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    try {
      const pool = await args.getPool();
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
          cookieName: args.cookieName,
          cookieSameSite: args.cookieSameSite,
          isProd: args.isProd
        });
        res.status(401).json({ ok: false, error: "invalid session" });
        return;
      }
      res.locals.user = row;
      next();
    } catch (e) {
      res.status(500).json({ ok: false, error: `db error: ${String(e)}` });
    }
  };
}
