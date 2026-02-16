/* eslint-disable no-console */

import { once } from "events";
import express from "express";
import authRoutesModule from "../dist/routes/authRoutes.js";

const { registerAuthRoutes } = authRoutesModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const sessions = new Map();
  const app = express();

  const getPool = async () => ({
    query: async (sql, params = []) => {
      if (sql.includes("where sessions.id = $1")) {
        const id = String(params[0] || "");
        const session = sessions.get(id);
        return { rows: session ? [session] : [] };
      }
      if (sql.includes("delete from sessions where id = $1")) {
        const id = String(params[0] || "");
        sessions.delete(id);
        return { rows: [] };
      }
      return { rows: [] };
    }
  });

  registerAuthRoutes(app, {
    getPool,
    cookieName: "arnvoid_session",
    cookieSameSite: "lax",
    cookieTtlMs: 1000 * 60 * 60,
    isProd: false,
    getProfileColumnsAvailable: () => false,
    googleClientId: "unused",
    verifyGoogleIdToken: async () => ({ sub: "unused" })
  });

  const server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("failed to resolve test server port");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const meNoCookie = await fetch(`${baseUrl}/me`, { method: "GET" });
    assert(meNoCookie.status === 200, `GET /me (no cookie) expected 200, got ${meNoCookie.status}`);
    const meNoCookieJson = await meNoCookie.json();
    assert(meNoCookieJson?.ok === true, "GET /me (no cookie) expected ok=true");
    assert(meNoCookieJson?.user === null, "GET /me (no cookie) expected user=null");
    assert(
      meNoCookie.headers.get("set-cookie") === null,
      "GET /me (no cookie) should not clear cookie"
    );
    console.log("[auth-me-contracts] /me no-cookie contract ok");

    const meMissingSession = await fetch(`${baseUrl}/me`, {
      method: "GET",
      headers: {
        Cookie: "arnvoid_session=missing-session-id"
      }
    });
    assert(
      meMissingSession.status === 200,
      `GET /me (missing session) expected 200, got ${meMissingSession.status}`
    );
    const meMissingSessionJson = await meMissingSession.json();
    assert(meMissingSessionJson?.ok === true, "GET /me (missing session) expected ok=true");
    assert(meMissingSessionJson?.user === null, "GET /me (missing session) expected user=null");
    assert(
      meMissingSession.headers.get("set-cookie") !== null,
      "GET /me (missing session) should clear cookie"
    );
    console.log("[auth-me-contracts] /me missing-session contract ok");

    const logoutMissingSession = await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: "arnvoid_session=missing-session-id"
      }
    });
    assert(
      logoutMissingSession.status === 200,
      `POST /auth/logout (missing session) expected 200, got ${logoutMissingSession.status}`
    );
    const logoutJson = await logoutMissingSession.json();
    assert(logoutJson?.ok === true, "POST /auth/logout expected ok=true");
    assert(
      logoutMissingSession.headers.get("set-cookie") !== null,
      "POST /auth/logout should clear cookie"
    );
    console.log("[auth-me-contracts] /auth/logout missing-session contract ok");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve(null);
      });
    });
  }
}

run()
  .then(() => {
    console.log("[auth-me-contracts] done");
  })
  .catch((error) => {
    console.error(`[auth-me-contracts] failed: ${error.message}`);
    process.exitCode = 1;
  });
