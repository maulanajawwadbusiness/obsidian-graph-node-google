import crypto from "crypto";
import type express from "express";
import type { MidtransRequestOptions, MidtransResult } from "../midtrans/client";

type QueryResult = {
  rows: any[];
  rowCount?: number;
};

type QueryablePool = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
};

export type PaymentsRouteDeps = {
  getPool: () => Promise<QueryablePool>;
  requireAuth: express.RequestHandler;
  getBalance: (userId: string) => Promise<{ balance_idr: number; updated_at: unknown }>;
  midtransRequest: <T = unknown>(
    path: string,
    opts?: MidtransRequestOptions
  ) => Promise<MidtransResult<T>>;
  parseGrossAmount: (value: unknown, fallbackAmount: number) => number | null;
  applyTopupFromMidtrans: (args: {
    userId: string;
    orderId: string;
    amountIdr: number;
  }) => Promise<unknown>;
  sanitizeActions: (value: unknown) => Array<{ name: string; method: string; url: string }>;
  isPaidStatus: (status: string | undefined) => boolean;
};

export function registerRupiahAndPaymentsCreateRoutes(
  app: express.Express,
  deps: PaymentsRouteDeps
): void {
  app.get("/api/rupiah/me", deps.requireAuth, async (_req, res) => {
    const user = res.locals.user as { id: string };
    try {
      const balance = await deps.getBalance(String(user.id));
      res.json({ ok: true, balance_idr: balance.balance_idr, updated_at: balance.updated_at });
    } catch (e) {
      res.status(500).json({ ok: false, error: "failed to load rupiah balance" });
    }
  });

  app.post("/api/payments/gopayqris/create", deps.requireAuth, async (req, res) => {
    const user = res.locals.user as { id: string };
    const grossAmount = deps.parseGrossAmount(req.body?.gross_amount, 1000);
    if (!grossAmount) {
      res.status(400).json({ ok: false, error: "invalid gross_amount" });
      return;
    }

    const orderId = `arnv-${user.id}-${Date.now()}`;
    const now = new Date();
    const rowId = crypto.randomUUID();

    try {
      const pool = await deps.getPool();
      await pool.query(
        `insert into payment_transactions
        (id, user_id, order_id, gross_amount, payment_type, status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [rowId, user.id, orderId, grossAmount, "gopay", "created", now, now]
      );
    } catch (e) {
      res.status(500).json({ ok: false, error: "failed to create transaction" });
      return;
    }

    const chargePayload = {
      payment_type: "gopay",
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount
      },
      gopay: {
        enable_callback: true,
        callback_url: "https://<your-domain>/payment/gopay-finish"
      }
    };

    const midtransResult = await deps.midtransRequest("/v2/charge", {
      method: "POST",
      body: chargePayload
    });

    if (midtransResult.ok === false) {
      try {
        const pool = await deps.getPool();
        await pool.query(
          `update payment_transactions
            set status = $2,
                midtrans_response_json = $3,
                updated_at = $4
          where order_id = $1`,
          [orderId, "failed", midtransResult.error, new Date()]
        );
      } catch {
        // Ignore update failure here.
      }

      res.status(502).json({ ok: false, error: midtransResult.error, order_id: orderId });
      return;
    }

    const data = midtransResult.data as {
      transaction_id?: string;
      transaction_status?: string;
      payment_type?: string;
      actions?: unknown;
    };

    const transactionId = data.transaction_id || null;
    const transactionStatus = data.transaction_status || "pending";
    const paymentType = data.payment_type || "gopay";
    const actions = deps.sanitizeActions(data.actions);

    try {
      const pool = await deps.getPool();
      await pool.query(
        `update payment_transactions
          set status = $2,
              midtrans_transaction_id = $3,
              midtrans_response_json = $4,
              updated_at = $5
        where order_id = $1`,
        [orderId, transactionStatus, transactionId, midtransResult.data, new Date()]
      );
    } catch (e) {
      res.status(500).json({ ok: false, error: "failed to store transaction" });
      return;
    }

    res.json({
      ok: true,
      order_id: orderId,
      transaction_id: transactionId,
      payment_type: paymentType,
      transaction_status: transactionStatus,
      actions
    });
  });
}

export function registerPaymentsStatusRoute(app: express.Express, deps: PaymentsRouteDeps): void {
  app.get("/api/payments/:orderId/status", deps.requireAuth, async (req, res) => {
    const user = res.locals.user as { id: string };
    const orderId = String(req.params.orderId || "");
    if (!orderId) {
      res.status(400).json({ ok: false, error: "missing orderId" });
      return;
    }

    const pool = await deps.getPool();
    const existing = await pool.query(
      `select order_id, status, payment_type, midtrans_transaction_id, paid_at, gross_amount
       from payment_transactions
      where order_id = $1 and user_id = $2`,
      [orderId, user.id]
    );

    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ ok: false, error: "not found" });
      return;
    }

    if (row.status === "pending") {
      const statusResult = await deps.midtransRequest(`/v2/${orderId}/status`, { method: "GET" });
      if (statusResult.ok) {
        const data = statusResult.data as { transaction_status?: string; transaction_id?: string };
        const nextStatus = data.transaction_status || row.status;
        const now = new Date();
        const paidAt = deps.isPaidStatus(nextStatus) ? now : null;

        try {
          await pool.query(
            `update payment_transactions
              set status = $2,
                  midtrans_transaction_id = coalesce($3, midtrans_transaction_id),
                  midtrans_response_json = $4,
                  updated_at = $5,
                  paid_at = case
                    when paid_at is null and $6 is not null then $6
                    else paid_at
                  end
            where order_id = $1`,
            [orderId, nextStatus, data.transaction_id || null, statusResult.data, now, paidAt]
          );
        } catch (e) {
          res.status(500).json({ ok: false, error: "failed to update status" });
          return;
        }

        if (paidAt) {
          try {
            await deps.applyTopupFromMidtrans({
              userId: String(user.id),
              orderId,
              amountIdr: Number(row.gross_amount || 0)
            });
          } catch {
            // Ignore credit application failures here.
          }
        }

        res.json({
          ok: true,
          order_id: orderId,
          status: nextStatus,
          payment_type: row.payment_type,
          transaction_id: data.transaction_id || row.midtrans_transaction_id,
          paid_at: paidAt || row.paid_at || null
        });
        return;
      }

      let midtransError: unknown = null;
      if (statusResult.ok === false) {
        midtransError = statusResult.error;
      }

      res.json({
        ok: true,
        order_id: orderId,
        status: row.status,
        payment_type: row.payment_type,
        transaction_id: row.midtrans_transaction_id,
        paid_at: row.paid_at || null,
        midtrans_error: midtransError
      });
      return;
    }

    if (row.paid_at) {
      try {
        await deps.applyTopupFromMidtrans({
          userId: String(user.id),
          orderId,
          amountIdr: Number(row.gross_amount || 0)
        });
      } catch {
        // Ignore credit application failures here.
      }
    }

    res.json({
      ok: true,
      order_id: orderId,
      status: row.status,
      payment_type: row.payment_type,
      transaction_id: row.midtrans_transaction_id,
      paid_at: row.paid_at || null
    });
  });
}
