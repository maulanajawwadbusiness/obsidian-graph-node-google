/* eslint-disable no-console */

import { once } from "events";
import express from "express";
import savedInterfacesRoutesModule from "../dist/routes/savedInterfacesRoutes.js";
import { createSilentLogger } from "./_testLogger.mjs";

const { registerSavedInterfacesRoutes } = savedInterfacesRoutesModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createFakePool() {
  let deleteRowCount = 0;

  return {
    setDeleteRowCount(value) {
      deleteRowCount = value;
    },

    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();

      if (
        normalized.includes("from saved_interfaces") &&
        normalized.includes("order by updated_at desc")
      ) {
        return {
          rows: [
            {
              client_interface_id: "if-1",
              title: "One",
              payload_version: 1,
              payload_json: { a: 1 },
              created_at: new Date("2026-01-01T00:00:00.000Z"),
              updated_at: new Date("2026-01-02T00:00:00.000Z")
            }
          ]
        };
      }

      if (normalized.startsWith("insert into saved_interfaces")) {
        return { rows: [] };
      }

      if (normalized.startsWith("delete from saved_interfaces")) {
        return { rows: [], rowCount: deleteRowCount };
      }

      throw new Error(`unexpected sql: ${normalized}; params=${JSON.stringify(params)}`);
    }
  };
}

function createApp(fakePool, maxPayloadBytes = 50) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  registerSavedInterfacesRoutes(app, {
    getPool: async () => fakePool,
    requireAuth: (_req, res, next) => {
      res.locals.user = { id: "u1" };
      next();
    },
    listLimit: 2,
    maxPayloadBytes,
    logger: createSilentLogger()
  });

  return app;
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
  const fakePool = createFakePool();
  const app = createApp(fakePool, 50);

  await withServer(app, async (baseUrl) => {
    const listRes = await fetch(`${baseUrl}/api/saved-interfaces`, { method: "GET" });
    assert(listRes.status === 200, `list expected 200, got ${listRes.status}`);
    const listJson = await listRes.json();
    assert(listJson?.ok === true, "list expected ok=true");
    assert(Array.isArray(listJson?.items), "list expected items array");
    assert(listJson.items.length === 1, "list expected one item in fake pool response");
    const first = listJson.items[0];
    assert(Object.prototype.hasOwnProperty.call(first, "client_interface_id"), "missing client_interface_id");
    assert(Object.prototype.hasOwnProperty.call(first, "title"), "missing title");
    assert(Object.prototype.hasOwnProperty.call(first, "payload_version"), "missing payload_version");
    assert(Object.prototype.hasOwnProperty.call(first, "payload_json"), "missing payload_json");
    assert(Object.prototype.hasOwnProperty.call(first, "created_at"), "missing created_at");
    assert(Object.prototype.hasOwnProperty.call(first, "updated_at"), "missing updated_at");
    console.log("[saved-interfaces-contracts] list contract ok");

    const missingId = await fetch(`${baseUrl}/api/saved-interfaces/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "A", payloadVersion: 1, payloadJson: {} })
    });
    assert(missingId.status === 400, `missing id expected 400, got ${missingId.status}`);
    const missingIdJson = await missingId.json();
    assert(missingIdJson?.ok === false, "missing id expected ok=false");

    const missingTitle = await fetch(`${baseUrl}/api/saved-interfaces/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientInterfaceId: "if-1", payloadVersion: 1, payloadJson: {} })
    });
    assert(missingTitle.status === 400, `missing title expected 400, got ${missingTitle.status}`);
    const missingTitleJson = await missingTitle.json();
    assert(missingTitleJson?.ok === false, "missing title expected ok=false");

    const invalidVersion = await fetch(`${baseUrl}/api/saved-interfaces/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientInterfaceId: "if-1", title: "A", payloadVersion: 0, payloadJson: {} })
    });
    assert(invalidVersion.status === 400, `invalid version expected 400, got ${invalidVersion.status}`);
    const invalidVersionJson = await invalidVersion.json();
    assert(invalidVersionJson?.ok === false, "invalid version expected ok=false");

    const payloadNotObject = await fetch(`${baseUrl}/api/saved-interfaces/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientInterfaceId: "if-1",
        title: "A",
        payloadVersion: 1,
        payloadJson: "bad"
      })
    });
    assert(payloadNotObject.status === 400, `payload not object expected 400, got ${payloadNotObject.status}`);
    const payloadNotObjectJson = await payloadNotObject.json();
    assert(payloadNotObjectJson?.ok === false, "payload not object expected ok=false");
    console.log("[saved-interfaces-contracts] upsert validation branches contract ok");

    const tooLarge = await fetch(`${baseUrl}/api/saved-interfaces/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientInterfaceId: "if-1",
        title: "A",
        payloadVersion: 1,
        payloadJson: { big: "x".repeat(200) }
      })
    });
    assert(tooLarge.status === 413, `too large expected 413, got ${tooLarge.status}`);
    const tooLargeJson = await tooLarge.json();
    assert(tooLargeJson?.ok === false, "too large expected ok=false");
    assert(
      tooLargeJson?.error === "saved interface payload too large",
      "too large expected exact saved interface payload too large message"
    );
    console.log("[saved-interfaces-contracts] upsert 413 contract ok");

    const success = await fetch(`${baseUrl}/api/saved-interfaces/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientInterfaceId: "if-1",
        title: "A",
        payloadVersion: 1,
        payloadJson: { small: 1 }
      })
    });
    assert(success.status === 200, `upsert success expected 200, got ${success.status}`);
    const successJson = await success.json();
    assert(successJson?.ok === true, "upsert success expected ok=true");
    console.log("[saved-interfaces-contracts] upsert success contract ok");

    const deleteMissingId = await fetch(`${baseUrl}/api/saved-interfaces/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert(deleteMissingId.status === 400, `delete missing id expected 400, got ${deleteMissingId.status}`);
    const deleteMissingIdJson = await deleteMissingId.json();
    assert(deleteMissingIdJson?.ok === false, "delete missing id expected ok=false");

    fakePool.setDeleteRowCount(0);
    const deleteFalse = await fetch(`${baseUrl}/api/saved-interfaces/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientInterfaceId: "if-1" })
    });
    assert(deleteFalse.status === 200, `delete false expected 200, got ${deleteFalse.status}`);
    const deleteFalseJson = await deleteFalse.json();
    assert(deleteFalseJson?.ok === true, "delete false expected ok=true");
    assert(deleteFalseJson?.deleted === false, "delete false expected deleted=false");

    fakePool.setDeleteRowCount(1);
    const deleteTrue = await fetch(`${baseUrl}/api/saved-interfaces/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientInterfaceId: "if-1" })
    });
    assert(deleteTrue.status === 200, `delete true expected 200, got ${deleteTrue.status}`);
    const deleteTrueJson = await deleteTrue.json();
    assert(deleteTrueJson?.ok === true, "delete true expected ok=true");
    assert(deleteTrueJson?.deleted === true, "delete true expected deleted=true");
    console.log("[saved-interfaces-contracts] delete contract ok");
  });
}

run()
  .then(() => {
    console.log("[saved-interfaces-contracts] done");
  })
  .catch((error) => {
    console.error(`[saved-interfaces-contracts] failed: ${error.message}`);
    process.exitCode = 1;
  });
