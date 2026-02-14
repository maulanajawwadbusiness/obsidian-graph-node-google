/* eslint-disable no-console */

import { once } from "events";
import express from "express";
import paymentsRoutesModule from "../dist/routes/paymentsRoutes.js";

const { registerRupiahAndPaymentsCreateRoutes } = paymentsRoutesModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const app = express();

  registerRupiahAndPaymentsCreateRoutes(app, {
    getPool: async () => ({ query: async () => ({ rows: [] }) }),
    requireAuth: (_req, res, next) => {
      res.locals.user = { id: "u1" };
      next();
    },
    getBalance: async () => ({ balance_idr: 7777, updated_at: "2026-02-14T00:00:00.000Z" }),
    midtransRequest: async () => ({ ok: false, error: "unused" }),
    parseGrossAmount: () => 1000,
    applyTopupFromMidtrans: async () => undefined,
    sanitizeActions: () => [],
    isPaidStatus: () => false
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
    const response = await fetch(`${baseUrl}/api/rupiah/me`, { method: "GET" });
    assert(response.status === 200, `expected 200, got ${response.status}`);
    const json = await response.json();
    assert(json?.ok === true, "expected ok=true");
    assert(typeof json?.balance_idr === "number", "expected numeric balance_idr");
    assert(Object.prototype.hasOwnProperty.call(json, "updated_at"), "expected updated_at key");
    console.log("[rupiah-contracts] contract ok");
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
    console.log("[rupiah-contracts] done");
  })
  .catch((error) => {
    console.error(`[rupiah-contracts] failed: ${error.message}`);
    process.exitCode = 1;
  });
