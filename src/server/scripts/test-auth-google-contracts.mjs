/* eslint-disable no-console */

import { once } from "events";
import express from "express";
import authRoutesModule from "../dist/routes/authRoutes.js";

const { registerAuthRoutes } = authRoutesModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class FakePool {
  constructor() {
    this.usersBySub = new Map();
    this.usersById = new Map();
    this.sessionsById = new Map();
    this.nextUserId = 1;
  }

  async query(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();

    if (normalized.startsWith("insert into users")) {
      const googleSub = String(params[0]);
      const email = params[1] == null ? null : String(params[1]);
      const name = params[2] == null ? null : String(params[2]);
      const picture = params[3] == null ? null : String(params[3]);

      let user = this.usersBySub.get(googleSub);
      if (!user) {
        user = {
          id: String(this.nextUserId++),
          google_sub: googleSub,
          email,
          name,
          picture,
          display_name: null,
          username: null
        };
      } else {
        user = {
          ...user,
          email,
          name,
          picture
        };
      }

      this.usersBySub.set(googleSub, user);
      this.usersById.set(String(user.id), user);

      const includeProfile = normalized.includes("display_name") || normalized.includes("username");
      if (includeProfile) {
        return {
          rows: [
            {
              id: user.id,
              google_sub: user.google_sub,
              email: user.email,
              name: user.name,
              picture: user.picture,
              display_name: user.display_name,
              username: user.username
            }
          ]
        };
      }

      return {
        rows: [
          {
            id: user.id,
            google_sub: user.google_sub,
            email: user.email,
            name: user.name,
            picture: user.picture
          }
        ]
      };
    }

    if (normalized.startsWith("insert into sessions")) {
      const sessionId = String(params[0]);
      const userId = String(params[1]);
      const expiresAt = params[2] instanceof Date ? params[2] : new Date(String(params[2]));
      this.sessionsById.set(sessionId, {
        id: sessionId,
        user_id: userId,
        expires_at: expiresAt
      });
      return { rows: [] };
    }

    if (
      normalized.includes("from sessions") &&
      normalized.includes("join users") &&
      normalized.includes("where sessions.id = $1")
    ) {
      const sessionId = String(params[0]);
      const session = this.sessionsById.get(sessionId);
      if (!session) return { rows: [] };
      const user = this.usersById.get(String(session.user_id));
      if (!user) return { rows: [] };

      const includeProfile = normalized.includes("display_name as display_name");
      if (includeProfile) {
        return {
          rows: [
            {
              expires_at: session.expires_at,
              google_sub: user.google_sub,
              email: user.email,
              name: user.name,
              picture: user.picture,
              display_name: user.display_name,
              username: user.username
            }
          ]
        };
      }

      return {
        rows: [
          {
            expires_at: session.expires_at,
            google_sub: user.google_sub,
            email: user.email,
            name: user.name,
            picture: user.picture
          }
        ]
      };
    }

    if (normalized.startsWith("delete from sessions where id = $1")) {
      const sessionId = String(params[0]);
      this.sessionsById.delete(sessionId);
      return { rows: [] };
    }

    throw new Error(`unhandled sql in fake pool: ${normalized}`);
  }
}

async function startAuthServer({ isProd, profileColumnsAvailable, googleClientId }) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const pool = new FakePool();

  registerAuthRoutes(app, {
    getPool: async () => pool,
    cookieName: "arnvoid_session",
    cookieSameSite: "lax",
    cookieTtlMs: 60 * 60 * 1000,
    isProd,
    getProfileColumnsAvailable: () => profileColumnsAvailable,
    googleClientId,
    verifyGoogleIdToken: async ({ idToken }) => {
      if (idToken === "good") {
        return {
          sub: "sub123",
          email: "a@b.com",
          name: "A",
          picture: "P"
        };
      }
      if (idToken === "missing-sub") {
        return {
          email: "a@b.com",
          name: "A",
          picture: "P"
        };
      }
      throw new Error("invalid token");
    }
  });

  const server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("failed to resolve test server port");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

function getCookieHeaderValue(setCookieHeader) {
  assert(!!setCookieHeader, "expected set-cookie header");
  const parts = String(setCookieHeader).split(";");
  return parts[0];
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve(null);
    });
  });
}

async function runPrimaryMatrix() {
  const { server, baseUrl } = await startAuthServer({
    isProd: false,
    profileColumnsAvailable: true,
    googleClientId: "test-client-id"
  });

  try {
    const missingIdToken = await fetch(`${baseUrl}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert(
      missingIdToken.status < 200 || missingIdToken.status >= 300,
      `missing idToken expected non-2xx, got ${missingIdToken.status}`
    );
    const missingJson = await missingIdToken.json();
    assert(missingJson?.ok === false, "missing idToken expected ok=false");
    assert(typeof missingJson?.error === "string", "missing idToken expected error string");
    assert(missingIdToken.headers.get("set-cookie") === null, "missing idToken should not set cookie");
    console.log("[auth-google-contracts] missing idToken contract ok");

    const invalidToken = await fetch(`${baseUrl}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "bad" })
    });
    assert(
      invalidToken.status < 200 || invalidToken.status >= 300,
      `invalid token expected non-2xx, got ${invalidToken.status}`
    );
    const invalidJson = await invalidToken.json();
    assert(invalidJson?.ok === false, "invalid token expected ok=false");
    assert(typeof invalidJson?.error === "string", "invalid token expected error string");
    assert(invalidToken.headers.get("set-cookie") === null, "invalid token should not set cookie");
    console.log("[auth-google-contracts] invalid token contract ok");

    const success = await fetch(`${baseUrl}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "good" })
    });
    assert(success.status === 200, `success expected 200, got ${success.status}`);
    const successJson = await success.json();
    assert(successJson?.ok === true, "success expected ok=true");
    assert(successJson?.user && typeof successJson.user === "object", "success expected user object");
    assert(successJson.user.sub === "sub123", "success expected user.sub=sub123");
    assert(typeof successJson.user.email === "string", "success expected user.email string");

    const setCookie = success.headers.get("set-cookie");
    assert(setCookie !== null, "success expected set-cookie");
    const setCookieText = String(setCookie);
    assert(setCookieText.includes("arnvoid_session="), "set-cookie missing session cookie name");
    assert(setCookieText.includes("HttpOnly"), "set-cookie missing HttpOnly");
    assert(setCookieText.includes("Path=/"), "set-cookie missing Path=/");
    assert(setCookieText.includes("SameSite=Lax"), "set-cookie missing SameSite=Lax");
    assert(
      setCookieText.includes("Max-Age=") || setCookieText.includes("Expires="),
      "set-cookie missing Max-Age or Expires"
    );
    console.log("[auth-google-contracts] success cookie contract ok");

    const cookieHeader = getCookieHeaderValue(setCookie);
    const me = await fetch(`${baseUrl}/me`, {
      method: "GET",
      headers: {
        Cookie: cookieHeader
      }
    });
    assert(me.status === 200, `follow-up /me expected 200, got ${me.status}`);
    const meJson = await me.json();
    assert(meJson?.ok === true, "follow-up /me expected ok=true");
    assert(meJson?.user !== null, "follow-up /me expected non-null user");
    assert(meJson?.user?.sub === "sub123", "follow-up /me expected matching sub");
    console.log("[auth-google-contracts] follow-up /me contract ok");
  } finally {
    await closeServer(server);
  }
}

async function runSecureCookieVariant() {
  const { server, baseUrl } = await startAuthServer({
    isProd: true,
    profileColumnsAvailable: true,
    googleClientId: "test-client-id"
  });

  try {
    const success = await fetch(`${baseUrl}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "good" })
    });
    assert(success.status === 200, `secure variant expected 200, got ${success.status}`);
    const setCookie = success.headers.get("set-cookie");
    assert(setCookie !== null, "secure variant expected set-cookie");
    assert(String(setCookie).includes("Secure"), "secure variant expected Secure cookie flag");
    console.log("[auth-google-contracts] secure cookie variant contract ok");
  } finally {
    await closeServer(server);
  }
}

async function runProfileColumnsFalseVariant() {
  const { server, baseUrl } = await startAuthServer({
    isProd: false,
    profileColumnsAvailable: false,
    googleClientId: "test-client-id"
  });

  try {
    const success = await fetch(`${baseUrl}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "good" })
    });
    assert(success.status === 200, `profile false variant expected 200, got ${success.status}`);
    const body = await success.json();
    assert(body?.ok === true, "profile false variant expected ok=true");
    assert(body?.user?.sub === "sub123", "profile false variant expected user.sub");
    console.log("[auth-google-contracts] profileColumnsAvailable=false variant contract ok");
  } finally {
    await closeServer(server);
  }
}

async function runMissingClientIdCase() {
  const { server, baseUrl } = await startAuthServer({
    isProd: false,
    profileColumnsAvailable: true,
    googleClientId: undefined
  });

  try {
    const response = await fetch(`${baseUrl}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "good" })
    });
    assert(
      response.status < 200 || response.status >= 300,
      `missing client id expected non-2xx, got ${response.status}`
    );
    const json = await response.json();
    assert(json?.ok === false, "missing client id expected ok=false");
    assert(typeof json?.error === "string", "missing client id expected error string");
    assert(response.headers.get("set-cookie") === null, "missing client id should not set cookie");
    console.log("[auth-google-contracts] missing GOOGLE_CLIENT_ID contract ok");
  } finally {
    await closeServer(server);
  }
}

async function run() {
  await runPrimaryMatrix();
  await runSecureCookieVariant();
  await runProfileColumnsFalseVariant();
  await runMissingClientIdCase();
}

run()
  .then(() => {
    console.log("[auth-google-contracts] done");
  })
  .catch((error) => {
    console.error(`[auth-google-contracts] failed: ${error.message}`);
    process.exitCode = 1;
  });
