/* eslint-disable no-console */

import { once } from "events";
import express from "express";
import healthRoutesModule from "../dist/routes/healthRoutes.js";

const { registerHealthRoutes } = healthRoutesModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  let queryCalls = 0;
  const app = express();

  registerHealthRoutes(app, {
    getPool: async () => ({
      query: async (sql) => {
        queryCalls += 1;
        assert(sql === "SELECT 1", `expected SELECT 1 probe, got ${String(sql)}`);
        return { rows: [] };
      }
    })
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
    const response = await fetch(`${baseUrl}/health`, { method: "GET" });
    assert(response.status === 200, `GET /health expected 200, got ${response.status}`);
    const json = await response.json();
    assert(json && json.ok === true, "GET /health expected { ok: true }");
    assert(Object.prototype.hasOwnProperty.call(json, "ok"), "GET /health missing ok key");
    assert(queryCalls === 1, `expected one SELECT 1 call, got ${queryCalls}`);
    console.log("[health-contracts] GET /health contract ok");
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
    console.log("[health-contracts] done");
  })
  .catch((error) => {
    console.error(`[health-contracts] failed: ${error.message}`);
    process.exitCode = 1;
  });
