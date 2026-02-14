/* eslint-disable no-console */

import { once } from "events";
import express from "express";
import paymentsRoutesModule from "../dist/routes/paymentsRoutes.js";

const { registerRupiahAndPaymentsCreateRoutes, registerPaymentsStatusRoute } = paymentsRoutesModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGrossAmount(value, fallbackAmount) {
  if (value === undefined || value === null) return fallbackAmount;
  const amount = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.trunc(amount);
  if (rounded <= 0) return null;
  return rounded;
}

function sanitizeActions(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const name = String(item.name || "").trim();
    const method = String(item.method || "").trim();
    const url = String(item.url || "").trim();
    if (name && method && url) out.push({ name, method, url });
  }
  return out;
}

function isPaidStatus(status) {
  return status === "settlement" || status === "capture";
}

function createHarness({ chargeResult, statusResult }) {
  const txByOrderId = new Map();
  let topupCalls = 0;

  const fakePool = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();

      if (normalized.startsWith("insert into payment_transactions")) {
        const [id, userId, orderId, grossAmount, paymentType, status] = params;
        txByOrderId.set(String(orderId), {
          id,
          user_id: String(userId),
          order_id: String(orderId),
          gross_amount: Number(grossAmount),
          payment_type: String(paymentType),
          status: String(status),
          midtrans_transaction_id: null,
          paid_at: null,
          midtrans_response_json: null
        });
        return { rows: [], rowCount: 1 };
      }

      if (
        normalized.startsWith("update payment_transactions") &&
        normalized.includes("set status = $2") &&
        normalized.includes("midtrans_response_json = $3")
      ) {
        const [orderId, nextStatus, midtransResponse] = params;
        const row = txByOrderId.get(String(orderId));
        if (row) {
          row.status = String(nextStatus);
          row.midtrans_response_json = midtransResponse;
        }
        return { rows: [], rowCount: row ? 1 : 0 };
      }

      if (
        normalized.startsWith("update payment_transactions") &&
        normalized.includes("midtrans_transaction_id = $3")
      ) {
        const [orderId, nextStatus, transactionId, midtransResponse] = params;
        const row = txByOrderId.get(String(orderId));
        if (row) {
          row.status = String(nextStatus);
          row.midtrans_transaction_id = transactionId ? String(transactionId) : row.midtrans_transaction_id;
          row.midtrans_response_json = midtransResponse;
        }
        return { rows: [], rowCount: row ? 1 : 0 };
      }

      if (
        normalized.startsWith("update payment_transactions") &&
        normalized.includes("midtrans_transaction_id = coalesce")
      ) {
        const [orderId, nextStatus, transactionId, midtransResponse, _updatedAt, paidAt] = params;
        const row = txByOrderId.get(String(orderId));
        if (row) {
          row.status = String(nextStatus);
          if (transactionId) row.midtrans_transaction_id = String(transactionId);
          row.midtrans_response_json = midtransResponse;
          if (!row.paid_at && paidAt) row.paid_at = paidAt;
        }
        return { rows: [], rowCount: row ? 1 : 0 };
      }

      if (normalized.includes("from payment_transactions") && normalized.includes("where order_id = $1 and user_id = $2")) {
        const [orderId, userId] = params;
        const row = txByOrderId.get(String(orderId));
        if (!row || row.user_id !== String(userId)) return { rows: [] };
        return {
          rows: [
            {
              order_id: row.order_id,
              status: row.status,
              payment_type: row.payment_type,
              midtrans_transaction_id: row.midtrans_transaction_id,
              paid_at: row.paid_at,
              gross_amount: row.gross_amount
            }
          ]
        };
      }

      throw new Error(`unexpected sql: ${normalized}`);
    }
  };

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const deps = {
    getPool: async () => fakePool,
    requireAuth: (_req, res, next) => {
      res.locals.user = { id: "u1" };
      next();
    },
    getBalance: async () => ({ balance_idr: 0, updated_at: null }),
    midtransRequest: async (path, init) => {
      if (path === "/v2/charge" && init && init.method === "POST") return chargeResult;
      if (path.includes("/status") && init && init.method === "GET") return statusResult;
      return { ok: false, error: "unexpected_midtrans_request" };
    },
    parseGrossAmount,
    applyTopupFromMidtrans: async () => {
      topupCalls += 1;
      return undefined;
    },
    sanitizeActions,
    isPaidStatus
  };

  registerRupiahAndPaymentsCreateRoutes(app, deps);
  registerPaymentsStatusRoute(app, deps);

  return {
    app,
    getTopupCalls: () => topupCalls
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
  const successHarness = createHarness({
    chargeResult: {
      ok: true,
      data: {
        transaction_id: "tx-create",
        transaction_status: "pending",
        payment_type: "gopay",
        actions: [{ name: "pay", method: "GET", url: "https://pay.test" }]
      }
    },
    statusResult: {
      ok: true,
      data: {
        transaction_id: "tx-paid",
        transaction_status: "settlement"
      }
    }
  });

  await withServer(successHarness.app, async (baseUrl) => {
    const create = await fetch(`${baseUrl}/api/payments/gopayqris/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gross_amount: 1000 })
    });
    assert(create.status === 200, `create success expected 200, got ${create.status}`);
    const createJson = await create.json();
    assert(createJson?.ok === true, "create success expected ok=true");
    assert(typeof createJson?.order_id === "string", "create success expected order_id");
    assert(Object.prototype.hasOwnProperty.call(createJson, "actions"), "create success expected actions key");
    const orderId = String(createJson.order_id);
    console.log("[payments-create-status-contracts] create success contract ok");

    const status = await fetch(`${baseUrl}/api/payments/${orderId}/status`, { method: "GET" });
    assert(status.status === 200, `status pending->paid expected 200, got ${status.status}`);
    const statusJson = await status.json();
    assert(statusJson?.ok === true, "status pending->paid expected ok=true");
    assert(typeof statusJson?.status === "string", "status pending->paid expected status key");
    assert(Object.prototype.hasOwnProperty.call(statusJson, "payment_type"), "status response expected payment_type");
    assert(Object.prototype.hasOwnProperty.call(statusJson, "transaction_id"), "status response expected transaction_id");
    assert(successHarness.getTopupCalls() >= 1, "status paid transition expected topup apply call");
    console.log("[payments-create-status-contracts] status pending success contract ok");
  });

  const createFailureHarness = createHarness({
    chargeResult: { ok: false, error: "midtrans charge failed" },
    statusResult: { ok: false, error: "unused" }
  });

  await withServer(createFailureHarness.app, async (baseUrl) => {
    const createFail = await fetch(`${baseUrl}/api/payments/gopayqris/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gross_amount: 1000 })
    });
    assert(createFail.status === 502, `create failure expected 502, got ${createFail.status}`);
    const createFailJson = await createFail.json();
    assert(createFailJson?.ok === false, "create failure expected ok=false");
    assert(typeof createFailJson?.order_id === "string", "create failure expected order_id");
    console.log("[payments-create-status-contracts] create failure contract ok");
  });

  const status404Harness = createHarness({
    chargeResult: { ok: false, error: "unused" },
    statusResult: { ok: false, error: "unused" }
  });

  await withServer(status404Harness.app, async (baseUrl) => {
    const status404 = await fetch(`${baseUrl}/api/payments/missing-order/status`, { method: "GET" });
    assert(status404.status === 404, `status missing expected 404, got ${status404.status}`);
    const status404Json = await status404.json();
    assert(status404Json?.ok === false, "status missing expected ok=false");
    console.log("[payments-create-status-contracts] status 404 contract ok");
  });

  const pendingErrorHarness = createHarness({
    chargeResult: {
      ok: true,
      data: {
        transaction_id: "tx-create",
        transaction_status: "pending",
        payment_type: "gopay",
        actions: []
      }
    },
    statusResult: { ok: false, error: "midtrans timeout" }
  });

  await withServer(pendingErrorHarness.app, async (baseUrl) => {
    const create = await fetch(`${baseUrl}/api/payments/gopayqris/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gross_amount: 1000 })
    });
    const createJson = await create.json();
    const orderId = String(createJson.order_id);

    const status = await fetch(`${baseUrl}/api/payments/${orderId}/status`, { method: "GET" });
    assert(status.status === 200, `status pending error expected 200, got ${status.status}`);
    const statusJson = await status.json();
    assert(statusJson?.ok === true, "status pending error expected ok=true");
    assert(Object.prototype.hasOwnProperty.call(statusJson, "midtrans_error"), "status pending error expected midtrans_error key");
    console.log("[payments-create-status-contracts] status pending error contract ok");
  });
}

run()
  .then(() => {
    console.log("[payments-create-status-contracts] done");
  })
  .catch((error) => {
    console.error(`[payments-create-status-contracts] failed: ${error.message}`);
    process.exitCode = 1;
  });
