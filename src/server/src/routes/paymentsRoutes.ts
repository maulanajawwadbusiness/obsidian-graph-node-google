import express from "express";
import { getPool } from "../db";
import { midtransRequest } from "../midtrans/client";
import { applyTopupFromMidtrans, getBalance } from "../rupiah/rupiahService";
import { AuthContext, isProd } from "../app/deps";
import { requireAuth } from "../middleware/requireAuth";
import { isDevBalanceBypassEnabled, isPaidStatus, parseGrossAmount, verifyMidtransSignature } from "../util/serverUtils";

export function registerPaymentsRoutes(app: express.Express) {
  app.post("/api/payments/webhook", async (req, res) => {
    const body = req.body;
    const signatureOk = verifyMidtransSignature(body);
    if (!signatureOk) {
      res.status(401).json({ ok: false, error: "invalid signature" });
      return;
    }

    const orderId = String(body?.order_id || "");
    const transactionStatus = String(body?.transaction_status || "");
    const statusCode = String(body?.status_code || "");
    const grossAmount = String(body?.gross_amount || "");
    const paymentType = String(body?.payment_type || "");
    const rawPayload = body ? JSON.stringify(body) : "{}";

    let eventId: string | null = null;
    try {
      const pool = await getPool();
      const result = await pool.query(
        `insert into payment_webhook_events
          (order_id, transaction_status, status_code, gross_amount, payment_type, payload_json, processed)
         values ($1, $2, $3, $4, $5, $6::jsonb, false)
         returning id`,
        [orderId, transactionStatus, statusCode, grossAmount, paymentType, rawPayload]
      );
      eventId = String(result.rows[0]?.id || "");
    } catch {
      res.status(500).json({ ok: false, error: "failed to record webhook" });
      return;
    }

    let processingError: string | null = null;
    let rupiahApplyError: string | null = null;

    if (isPaidStatus(transactionStatus)) {
      try {
        const pool = await getPool();
        const trx = await pool.query(
          `select id, user_id, gross_amount
             from payment_transactions
            where order_id = $1
            limit 1`,
          [orderId]
        );
        const row = trx.rows[0];
        if (row) {
          await applyTopupFromMidtrans({
            userId: String(row.user_id),
            orderId,
            amountIdr: Number(row.gross_amount || 0),
          });
        } else {
          rupiahApplyError = "rupiah apply failed: missing transaction row";
        }
      } catch {
        rupiahApplyError = "rupiah apply failed";
      }
    }

    if (!processingError && rupiahApplyError) {
      processingError = rupiahApplyError;
    }

    try {
      const pool = await getPool();
      await pool.query(
        `update payment_webhook_events
           set processed = $2, processing_error = $3
         where id = $1`,
        [eventId, true, processingError]
      );
    } catch {
      res.status(200).json({ ok: false, error: "failed to finalize webhook" });
      return;
    }

    res.status(200).json({ ok: true });
  });

  app.get("/api/rupiah/me", requireAuth, async (_req, res) => {
    const user = res.locals.user as AuthContext;
    try {
      const balance = await getBalance(String(user.id));
      res.json({ ok: true, balance_idr: balance.balance_idr, updated_at: balance.updated_at });
    } catch {
      res.status(500).json({ ok: false, error: "failed to load rupiah balance" });
    }
  });

  app.post("/api/payments/gopayqris/create", requireAuth, async (req, res) => {
    const user = res.locals.user as AuthContext;
    const grossAmount = parseGrossAmount(req.body?.gross_amount, 1000);
    if (!grossAmount) {
      res.status(400).json({ ok: false, error: "invalid gross_amount" });
      return;
    }

    if (!isDevBalanceBypassEnabled(isProd)) {
      try {
        const balance = await getBalance(String(user.id));
        if (balance.balance_idr > 0) {
          res.status(400).json({ ok: false, error: "topup only allowed when balance is zero" });
          return;
        }
      } catch {
        res.status(500).json({ ok: false, error: "failed to validate balance" });
        return;
      }
    }

    const orderId = `topup-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
      const payload = {
        payment_type: "qris",
        transaction_details: { order_id: orderId, gross_amount: grossAmount },
      };

      const response = await midtransRequest("/v2/charge", { method: "POST", body: payload });
      if (!response.ok) {
        res.status(502).json({ ok: false, error: "midtrans charge failed" });
        return;
      }
      const data: any = response.data;
      const actions = Array.isArray(data?.actions) ? data.actions : [];
      const qrAction = actions.find((item: any) => item?.name === "generate-qr-code");

      const pool = await getPool();
      await pool.query(
        `insert into payment_transactions (user_id, order_id, gross_amount, status, payload_json)
         values ($1, $2, $3, $4, $5::jsonb)`,
        [user.id, orderId, grossAmount, String(data?.transaction_status || "pending"), JSON.stringify(data)]
      );

      res.json({
        ok: true,
        order_id: orderId,
        transaction_status: String(data?.transaction_status || "pending"),
        actions,
        qr_url: qrAction?.url || null,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: `midtrans error: ${String(e)}` });
    }
  });

  app.get("/api/payments/:orderId/status", requireAuth, async (req, res) => {
    const user = res.locals.user as AuthContext;
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId) {
      res.status(400).json({ ok: false, error: "orderId is required" });
      return;
    }

    try {
      const pool = await getPool();
      const localResult = await pool.query(
        `select order_id, gross_amount, status, payload_json, created_at, updated_at
           from payment_transactions
          where user_id = $1 and order_id = $2
          limit 1`,
        [user.id, orderId]
      );
      const localRow = localResult.rows[0];
      if (!localRow) {
        res.status(404).json({ ok: false, error: "transaction not found" });
        return;
      }

      let remoteData: any = null;
      try {
        const remoteResult = await midtransRequest(`/v2/${encodeURIComponent(orderId)}/status`, { method: "GET" });
        if (!remoteResult.ok) {
          throw new Error("midtrans status failed");
        }
        remoteData = remoteResult.data as any;
        const remoteStatus = String(remoteData?.transaction_status || localRow.status || "pending");
        await pool.query(
          `update payment_transactions
              set status = $3,
                  payload_json = $4::jsonb,
                  updated_at = now()
            where user_id = $1 and order_id = $2`,
          [user.id, orderId, remoteStatus, JSON.stringify(remoteData)]
        );
      } catch {
        remoteData = null;
      }

      res.json({
        ok: true,
        order_id: orderId,
        gross_amount: Number(localRow.gross_amount || 0),
        status: String(remoteData?.transaction_status || localRow.status || "pending"),
        payload_json: remoteData || localRow.payload_json || null,
      });
    } catch {
      res.status(500).json({ ok: false, error: "failed to load payment status" });
    }
  });
}
