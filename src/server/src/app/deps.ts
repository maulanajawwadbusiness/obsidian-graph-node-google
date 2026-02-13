import express from "express";
import { getPool } from "../db";

export type AuthContext = {
  id: string;
  google_sub: string;
  email?: string | null;
};

export type SessionUser = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

export type TokenInfo = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

export const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "arnvoid_session";
export const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7);
export const COOKIE_SAMESITE = "lax";
export const DEFAULT_ALLOWED_ORIGINS = ["https://beta.arnvoid.com"];
export const DEV_PORTS = [5173, 5174, 5175, 5176, 5177, 5178];
export const DEFAULT_DEV_ORIGINS = DEV_PORTS.flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);

export const SAVED_INTERFACES_LIST_LIMIT = 20;
export const MAX_SAVED_INTERFACE_PAYLOAD_BYTES = Number(
  process.env.MAX_SAVED_INTERFACE_PAYLOAD_BYTES || 15 * 1024 * 1024
);
export const SAVED_INTERFACE_JSON_LIMIT = process.env.SAVED_INTERFACE_JSON_LIMIT || "15mb";
export const PROFILE_DISPLAY_NAME_MAX = 80;
export const PROFILE_USERNAME_MAX = 32;
export const PROFILE_USERNAME_REGEX = /^[A-Za-z0-9_.-]+$/;
export const FEEDBACK_MESSAGE_MAX_CHARS = 8000;
export const FEEDBACK_CATEGORY_MAX_CHARS = 64;

export function parseCookies(headerValue?: string) {
  const cookies: Record<string, string> = {};
  if (!headerValue) return cookies;
  const parts = headerValue.split(";");
  for (const part of parts) {
    const [rawName, ...rest] = part.split("=");
    const name = rawName.trim();
    if (!name) continue;
    cookies[name] = decodeURIComponent(rest.join("=").trim());
  }
  return cookies;
}

export function normalizeSameSite(value: string): "lax" | "none" | "strict" {
  if (value === "none" || value === "lax" || value === "strict") return value;
  return "lax";
}

export function isProd() {
  return Boolean(process.env.K_SERVICE) || process.env.NODE_ENV === "production";
}

export function resolveCookieOptions() {
  const sameSite = normalizeSameSite(COOKIE_SAMESITE);
  const secure = isProd();
  return { sameSite, secure };
}

export function clearSessionCookie(res: express.Response) {
  const { sameSite, secure } = resolveCookieOptions();
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
  });
}

export async function detectProfileColumnsAvailability(): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.query(
    `select column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = 'users'
        and column_name in ('display_name', 'username')`
  );
  const found = new Set((result.rows || []).map((row: any) => String(row.column_name)));
  return found.has("display_name") && found.has("username");
}
