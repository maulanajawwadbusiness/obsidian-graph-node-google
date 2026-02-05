import crypto from "crypto";
import express from "express";
import { getPool } from "./db";

type SessionUser = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

type SessionRecord = {
  user: SessionUser;
  expiresAt: number;
};

type TokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  exp?: string;
  email_verified?: string;
};

const app = express();
const port = Number(process.env.PORT || 8080);

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "session";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const COOKIE_SAMESITE = (process.env.SESSION_COOKIE_SAMESITE || "lax").toLowerCase();
const COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE
  ? process.env.SESSION_COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const sessions = new Map<string, SessionRecord>();

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
  }

  next();
});

function parseCookies(headerValue?: string) {
  const cookies: Record<string, string> = {};
  if (!headerValue) return cookies;

  const parts = headerValue.split(";");
  for (const part of parts) {
    const [rawName, ...rest] = part.split("=");
    const name = rawName.trim();
    if (!name) continue;
    const value = rest.join("=").trim();
    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

function getSession(req: express.Request) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  if (!sessionId) return null;

  const record = sessions.get(sessionId);
  if (!record) return null;

  if (Date.now() > record.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return record;
}

function normalizeSameSite(value: string): "lax" | "none" | "strict" {
  if (value === "none" || value === "lax" || value === "strict") return value;
  return "lax";
}

app.get("/health", async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

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
    const tokenRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!tokenRes.ok) {
      res.status(401).json({ ok: false, error: "invalid google token" });
      return;
    }
    tokenInfo = (await tokenRes.json()) as TokenInfo;
  } catch (e) {
    res.status(502).json({ ok: false, error: `token validation failed: ${String(e)}` });
    return;
  }

  if (!tokenInfo?.sub) {
    res.status(401).json({ ok: false, error: "token missing subject" });
    return;
  }

  if (tokenInfo.aud !== clientId) {
    res.status(401).json({ ok: false, error: "token audience mismatch" });
    return;
  }

  const expSeconds = tokenInfo.exp ? Number(tokenInfo.exp) : 0;
  if (expSeconds && Date.now() / 1000 > expSeconds) {
    res.status(401).json({ ok: false, error: "token expired" });
    return;
  }

  const user: SessionUser = {
    sub: tokenInfo.sub,
    email: tokenInfo.email,
    name: tokenInfo.name,
    picture: tokenInfo.picture
  };

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { user, expiresAt: Date.now() + SESSION_TTL_MS });

  const sameSite = normalizeSameSite(COOKIE_SAMESITE);
  const secure = sameSite === "none" ? true : COOKIE_SECURE;

  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: SESSION_TTL_MS
  });

  res.json({ ok: true, user });
});

app.get("/me", (req, res) => {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ ok: false, user: null });
    return;
  }

  res.json({ ok: true, user: session.user });
});

app.post("/auth/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  if (sessionId) {
    sessions.delete(sessionId);
  }

  const sameSite = normalizeSameSite(COOKIE_SAMESITE);
  const secure = sameSite === "none" ? true : COOKIE_SECURE;

  res.cookie(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: 0
  });

  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`[server] listening on ${port}`);
});
