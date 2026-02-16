import type express from "express";

export function parseCookies(headerValue?: string): Record<string, string> {
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

export function normalizeSameSite(value: string): "lax" | "none" | "strict" {
  if (value === "none" || value === "lax" || value === "strict") return value;
  return "lax";
}

export function resolveCookieOptions(cfg: { cookieSameSite: string; isProd: boolean }) {
  const sameSite = normalizeSameSite(cfg.cookieSameSite);
  const secure = cfg.isProd;
  return { sameSite, secure };
}

export function clearSessionCookie(
  res: express.Response,
  cfg: { cookieName: string; cookieSameSite: string; isProd: boolean }
) {
  const { sameSite, secure } = resolveCookieOptions(cfg);
  res.clearCookie(cfg.cookieName, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/"
  });
}

export function setSessionCookie(
  res: express.Response,
  sessionId: string,
  cfg: { cookieName: string; sessionTtlMs: number; cookieSameSite: string; isProd: boolean }
) {
  const { sameSite, secure } = resolveCookieOptions(cfg);
  res.cookie(cfg.cookieName, sessionId, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: cfg.sessionTtlMs
  });
}

export function getSessionIdFromRequest(
  req: express.Request,
  cfg: { cookieName: string }
): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[cfg.cookieName];
  if (!sessionId) return null;
  return sessionId;
}
