import express from "express";
import { getPool } from "../db";
import { AuthContext, COOKIE_NAME, parseCookies } from "../app/deps";

export async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  if (!sessionId) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.query(
      `select u.id, u.google_sub, u.email
         from sessions s
         join users u on u.id = s.user_id
        where s.id = $1 and s.expires_at > now()`,
      [sessionId]
    );
    const row = result.rows[0] as AuthContext | undefined;
    if (!row) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }
    res.locals.user = row;
    next();
  } catch {
    res.status(500).json({ ok: false, error: "db error" });
  }
}
