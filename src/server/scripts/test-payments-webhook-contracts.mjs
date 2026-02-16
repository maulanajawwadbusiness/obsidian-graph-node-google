/* eslint-disable no-console */

import { once } from "events";
import express from "express";
import paymentsWebhookModule from "../dist/routes/paymentsWebhookRoute.js";

const { registerPaymentsWebhookRoute } = paymentsWebhookModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createWebhookHarness({ verifyResult, failFinalize = false, paymentRowExists = true }) {
  let topupCalls = 0;

  const transactionRows = new Map();
  transactionRows.set("order-1", {
    user_id: "u1",
    gross_amount: 1000
  });

  const fakePool = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();

      if (normalized.startsWith("insert into payment_webhook_events")) {
        return { rows: [], rowCount: 1 };
      }

      if (normalized.startsWith("update payment_webhook_events")) {
        if (failFinalize) throw new Error("finalize failed");
        return { rows: [], rowCount: 1 };
      }

      if (normalized.includes("from payment_transactions") && normalized.includes("where order_id = $1")) {
        const orderId = String(params[0]);
        if (!paymentRowExists) return { rows: [] };
        const row = transactionRows.get(orderId);
        return { rows: row ? [row] : [] };
      }

      throw new Error(`unexpected pool query: ${normalized}`);
    },

    async connect() {
      return {
        async query(sql, params = []) {
          const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
          if (normalized === "begin" || normalized === "commit" || normalized === "rollback") {
            return { rows: [], rowCount: 0 };
          }
          if (normalized.startsWith("update payment_transactions")) {
            const orderId = String(params[0]);
            if (!paymentRowExists || !transactionRows.has(orderId)) {
              return { rows: [], rowCount: 0 };
            }
            return { rows: [], rowCount: 1 };
          }
          throw new Error(`unexpected client query: ${normalized}`);
        },
        release() {
          return undefined;
        }
      };
    }
  };

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  registerPaymentsWebhookRoute(app, {
    getPool: async () => fakePool,
    verifyMidtransSignature: () => verifyResult,
    applyTopupFromMidtrans: async () => {
      topupCalls += 1;
      return undefined;
    },
    isPaidStatus: (status) => status === "settlement" || status === "capture"
  });

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

function webhookBody() {
  return {
    order_id: "order-1",
    transaction_id: "tx-1",
    signature_key: "sig",
    transaction_status: "settlement"
  };
}

async function run() {
  const invalidSigHarness = createWebhookHarness({ verifyResult: false });
  await withServer(invalidSigHarness.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookBody())
    });
    assert(response.status === 200, `invalid signature expected 200, got ${response.status}`);
    const json = await response.json();
    assert(json?.ok === true, "invalid signature expected ok=true after finalize");
    assert(invalidSigHarness.getTopupCalls() === 0, "invalid signature should not call topup");
    console.log("[payments-webhook-contracts] invalid signature contract ok");
  });

  const paidHarness = createWebhookHarness({ verifyResult: true });
  await withServer(paidHarness.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookBody())
    });
    assert(response.status === 200, `paid webhook expected 200, got ${response.status}`);
    const json = await response.json();
    assert(json?.ok === true, "paid webhook expected ok=true");
    assert(paidHarness.getTopupCalls() === 1, "paid webhook expected one topup call");
    console.log("[payments-webhook-contracts] verified paid contract ok");
  });

  const finalizeFailHarness = createWebhookHarness({ verifyResult: false, failFinalize: true });
  await withServer(finalizeFailHarness.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookBody())
    });
    assert(response.status === 200, `finalize fail expected 200, got ${response.status}`);
    const json = await response.json();
    assert(json?.ok === false, "finalize fail expected ok=false");
    assert(json?.error === "failed to finalize webhook", "finalize fail expected exact error message");
    console.log("[payments-webhook-contracts] finalize failure contract ok");
  });
}

run()
  .then(() => {
    console.log("[payments-webhook-contracts] done");
  })
  .catch((error) => {
    console.error(`[payments-webhook-contracts] failed: ${error.message}`);
    process.exitCode = 1;
  });
