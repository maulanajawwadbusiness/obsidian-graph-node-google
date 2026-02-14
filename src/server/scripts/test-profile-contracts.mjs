/* eslint-disable no-console */

import { once } from "events";
import express from "express";
import profileRoutesModule from "../dist/routes/profileRoutes.js";

const { registerProfileRoutes } = profileRoutesModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createApp(options) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  let queryCalls = 0;
  const fakePool = {
    query: async (sql, params = []) => {
      queryCalls += 1;
      const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      if (!normalized.startsWith("update users")) {
        throw new Error(`unexpected sql: ${normalized}`);
      }

      if (options.returnNoRow) {
        return { rows: [] };
      }

      return {
        rows: [
          {
            google_sub: "sub123",
            email: "test@example.com",
            name: "Profile User",
            picture: "pic",
            display_name: params[1],
            username: params[2]
          }
        ]
      };
    }
  };

  registerProfileRoutes(app, {
    getPool: async () => fakePool,
    requireAuth: (_req, res, next) => {
      res.locals.user = { id: "u1" };
      next();
    },
    getProfileColumnsAvailable: () => options.profileColumnsAvailable,
    profileDisplayNameMax: 80,
    profileUsernameMax: 32,
    profileUsernameRegex: /^[A-Za-z0-9_.-]+$/
  });

  return {
    app,
    getQueryCalls: () => queryCalls
  };
}

async function withServer(app, fn) {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("failed to resolve test server port");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve(null);
      });
    });
  }
}

async function run() {
  const gated = createApp({ profileColumnsAvailable: false, returnNoRow: false });
  await withServer(gated.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/profile/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "A", username: "valid_user" })
    });
    assert(response.status === 503, `gating expected 503, got ${response.status}`);
    const json = await response.json();
    assert(json?.ok === false, "gating expected ok=false");
    assert(typeof json?.error === "string", "gating expected error string");
    assert(gated.getQueryCalls() === 0, "gating should not hit DB");
    console.log("[profile-contracts] gating contract ok");
  });

  const invalidUsername = createApp({ profileColumnsAvailable: true, returnNoRow: false });
  await withServer(invalidUsername.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/profile/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Valid Name", username: "bad user" })
    });
    assert(response.status === 400, `invalid username expected 400, got ${response.status}`);
    const json = await response.json();
    assert(json?.ok === false, "invalid username expected ok=false");
    assert(invalidUsername.getQueryCalls() === 0, "invalid username should not hit DB");
    console.log("[profile-contracts] invalid username contract ok");
  });

  const success = createApp({ profileColumnsAvailable: true, returnNoRow: false });
  await withServer(success.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/profile/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "  Valid   Name  ", username: "valid_user" })
    });
    assert(response.status === 200, `success expected 200, got ${response.status}`);
    const json = await response.json();
    assert(json?.ok === true, "success expected ok=true");
    assert(json?.user && typeof json.user === "object", "success expected user object");
    assert(json.user.sub === "sub123", "success expected user.sub");
    assert(json.user.displayName === "Valid Name", "success expected normalized displayName");
    assert(json.user.username === "valid_user", "success expected username");
    assert(success.getQueryCalls() === 1, "success should hit DB once");
    console.log("[profile-contracts] success contract ok");
  });

  const notFound = createApp({ profileColumnsAvailable: true, returnNoRow: true });
  await withServer(notFound.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/profile/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Name", username: "valid_user" })
    });
    assert(response.status === 404, `not-found expected 404, got ${response.status}`);
    const json = await response.json();
    assert(json?.ok === false, "not-found expected ok=false");
    assert(notFound.getQueryCalls() === 1, "not-found should hit DB once");
    console.log("[profile-contracts] not-found contract ok");
  });
}

run()
  .then(() => {
    console.log("[profile-contracts] done");
  })
  .catch((error) => {
    console.error(`[profile-contracts] failed: ${error.message}`);
    process.exitCode = 1;
  });
