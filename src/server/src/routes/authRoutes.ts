import crypto from "crypto";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { getPool } from "../db";
import {
  clearSessionCookie,
  COOKIE_NAME,
  parseCookies,
  resolveCookieOptions,
  SESSION_TTL_MS,
  SessionUser,
  TokenInfo,
} from "../app/deps";

export function registerAuthRoutes(app: express.Express, getProfileColumnsAvailable: () => boolean) {
  app.post("/auth/google", async (req, res) => {
    const idToken = req.body?.idToken;
    if (!idToken) {
      res.status(400).json({ ok: false, error: "missing idToken" });
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      res.status(500).json({ ok: false, error: "GOOGLE_CLIENT_ID is not set" });
      return;
    }

    let tokenInfo: TokenInfo | null = null;
    try {
      const oauthClient = new OAuth2Client(clientId);
      const ticket = await oauthClient.verifyIdToken({ idToken, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.sub) {
        res.status(401).json({ ok: false, error: "token missing subject" });
        return;
      }
      tokenInfo = {
        sub: payload.sub,
        email: payload.email ?? undefined,
        name: payload.name ?? undefined,
        picture: payload.picture ?? undefined,
      };
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
      picture: tokenInfo.picture,
    };

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    let userRow: any = null;

    try {
      const pool = await getPool();
      const upsertSql = getProfileColumnsAvailable()
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
        user.picture ?? null,
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

    const { sameSite, secure } = resolveCookieOptions();
    res.cookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite,
      secure,
      path: "/",
      expires: expiresAt,
    });

    res.json({
      ok: true,
      user: {
        sub: userRow.google_sub,
        email: userRow.email ?? undefined,
        name: userRow.name ?? undefined,
        picture: userRow.picture ?? undefined,
        displayName: getProfileColumnsAvailable() ? userRow.display_name ?? undefined : undefined,
        username: getProfileColumnsAvailable() ? userRow.username ?? undefined : undefined,
      },
    });
  });

  app.get("/me", async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[COOKIE_NAME];
    if (!sessionId) {
      res.json({ ok: true, user: null });
      return;
    }

    try {
      const pool = await getPool();
      const result = await pool.query(
        `select u.google_sub, u.email, u.name, u.picture, u.display_name, u.username
         from sessions s
         join users u on u.id = s.user_id
         where s.id = $1 and s.expires_at > now()`,
        [sessionId]
      );
      const row = result.rows[0];
      if (!row) {
        clearSessionCookie(res);
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
          displayName: getProfileColumnsAvailable() ? row.display_name ?? undefined : undefined,
          username: getProfileColumnsAvailable() ? row.username ?? undefined : undefined,
        },
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: `db error: ${String(e)}` });
    }
  });

  app.post("/auth/logout", async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[COOKIE_NAME];
    if (sessionId) {
      try {
        const pool = await getPool();
        await pool.query("delete from sessions where id = $1", [sessionId]);
      } catch (e) {
        res.status(500).json({ ok: false, error: `db error: ${String(e)}` });
        return;
      }
    }

    clearSessionCookie(res);
    res.json({ ok: true });
  });
}
