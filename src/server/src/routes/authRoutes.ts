import crypto from "crypto";
import type express from "express";
import {
  clearSessionCookie,
  getSessionIdFromRequest,
  setSessionCookie
} from "../server/cookies";

type QueryResult = {
  rows: any[];
};

type QueryablePool = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
};

export type GoogleTokenInfo = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

export type AuthRouteDeps = {
  getPool: () => Promise<QueryablePool>;
  cookieName: string;
  cookieSameSite: string;
  cookieTtlMs: number;
  isProd: boolean;
  getProfileColumnsAvailable: () => boolean;
  googleClientId?: string;
  verifyGoogleIdToken: (args: { idToken: string; audience: string }) => Promise<GoogleTokenInfo>;
};

type SessionUser = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

export function registerAuthRoutes(app: express.Express, deps: AuthRouteDeps): void {
  app.post("/auth/google", async (req, res) => {
    const idToken = req.body?.idToken;
    if (!idToken) {
      res.status(400).json({ ok: false, error: "missing idToken" });
      return;
    }

    const clientId = deps.googleClientId;
    if (!clientId) {
      res.status(500).json({ ok: false, error: "GOOGLE_CLIENT_ID is not set" });
      return;
    }

    console.log("[auth] requiredAudience:", clientId);

    let tokenInfo: GoogleTokenInfo | null = null;
    try {
      tokenInfo = await deps.verifyGoogleIdToken({ idToken, audience: clientId });
      if (!tokenInfo?.sub) {
        res.status(401).json({ ok: false, error: "token missing subject" });
        return;
      }
    } catch (e) {
      res.status(401).json({ ok: false, error: `token validation failed: ${String(e)}` });
      return;
    }

    if (!tokenInfo?.sub) {
      res.status(401).json({ ok: false, error: "token missing subject" });
      return;
    }

    const user: SessionUser = {
      sub: tokenInfo.sub,
      email: tokenInfo.email,
      name: tokenInfo.name,
      picture: tokenInfo.picture
    };

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + deps.cookieTtlMs);
    const profileColumnsAvailable = deps.getProfileColumnsAvailable();

    let userRow: {
      id: string;
      google_sub: string;
      email: string | null;
      name: string | null;
      picture: string | null;
      display_name: string | null;
      username: string | null;
    } | null = null;

    try {
      const pool = await deps.getPool();
      const upsertSql = profileColumnsAvailable
        ? `insert into users (google_sub, email, name, picture)
         values ($1, $2, $3, $4)
         on conflict (google_sub)
         do update set email = excluded.email, name = excluded.name, picture = excluded.picture
         returning id, google_sub, email, name, picture, display_name, username`
        : `insert into users (google_sub, email, name, picture)
         values ($1, $2, $3, $4)
         on conflict (google_sub)
         do update set email = excluded.email, name = excluded.name, picture = excluded.picture
         returning id, google_sub, email, name, picture`;
      const upsertResult = await pool.query(upsertSql, [
        user.sub,
        user.email ?? null,
        user.name ?? null,
        user.picture ?? null
      ]);
      userRow = upsertResult.rows[0] || null;

      if (!userRow) {
        res.status(500).json({ ok: false, error: "failed to upsert user" });
        return;
      }

      await pool.query(
        `insert into sessions (id, user_id, expires_at)
       values ($1, $2, $3)`,
        [sessionId, userRow.id, expiresAt]
      );
    } catch (e) {
      res.status(500).json({ ok: false, error: `db error: ${String(e)}` });
      return;
    }

    setSessionCookie(res, sessionId, {
      cookieName: deps.cookieName,
      sessionTtlMs: deps.cookieTtlMs,
      cookieSameSite: deps.cookieSameSite,
      isProd: deps.isProd
    });

    res.json({
      ok: true,
      user: {
        sub: userRow.google_sub,
        email: userRow.email ?? undefined,
        name: userRow.name ?? undefined,
        picture: userRow.picture ?? undefined,
        displayName: profileColumnsAvailable ? userRow.display_name ?? undefined : undefined,
        username: profileColumnsAvailable ? userRow.username ?? undefined : undefined
      }
    });
  });

  app.get("/me", async (req, res) => {
    const sessionId = getSessionIdFromRequest(req, { cookieName: deps.cookieName });
    if (!sessionId) {
      res.json({ ok: true, user: null });
      return;
    }

    try {
      const pool = await deps.getPool();
      const profileColumnsAvailable = deps.getProfileColumnsAvailable();
      const meSql = profileColumnsAvailable
        ? `select sessions.expires_at as expires_at,
                users.google_sub as google_sub,
                users.email as email,
                users.name as name,
                users.picture as picture,
                users.display_name as display_name,
                users.username as username
           from sessions
           join users on users.id = sessions.user_id
          where sessions.id = $1`
        : `select sessions.expires_at as expires_at,
                users.google_sub as google_sub,
                users.email as email,
                users.name as name,
                users.picture as picture
           from sessions
           join users on users.id = sessions.user_id
          where sessions.id = $1`;
      const result = await pool.query(meSql, [sessionId]);

      const row = result.rows[0];
      if (!row) {
        clearSessionCookie(res, {
          cookieName: deps.cookieName,
          cookieSameSite: deps.cookieSameSite,
          isProd: deps.isProd
        });
        console.log("[auth] session missing -> cleared cookie");
        res.json({ ok: true, user: null });
        return;
      }

      const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
      if (expiresAt && Date.now() > expiresAt.getTime()) {
        await pool.query("delete from sessions where id = $1", [sessionId]);
        clearSessionCookie(res, {
          cookieName: deps.cookieName,
          cookieSameSite: deps.cookieSameSite,
          isProd: deps.isProd
        });
        console.log("[auth] session expired -> cleared cookie");
        res.json({ ok: true, user: null });
        return;
      }

      res.json({
        ok: true,
        user: {
          sub: row.google_sub,
          email: row.email ?? undefined,
          name: row.name ?? undefined,
          picture: row.picture ?? undefined,
          displayName: profileColumnsAvailable ? row.display_name ?? undefined : undefined,
          username: profileColumnsAvailable ? row.username ?? undefined : undefined
        }
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: `db error: ${String(e)}` });
    }
  });

  app.post("/auth/logout", async (req, res) => {
    const sessionId = getSessionIdFromRequest(req, { cookieName: deps.cookieName });
    if (sessionId) {
      try {
        const pool = await deps.getPool();
        await pool.query("delete from sessions where id = $1", [sessionId]);
      } catch (e) {
        res.status(500).json({ ok: false, error: `db error: ${String(e)}` });
        return;
      }
    }

    clearSessionCookie(res, {
      cookieName: deps.cookieName,
      cookieSameSite: deps.cookieSameSite,
      isProd: deps.isProd
    });
    res.json({ ok: true });
  });
}
