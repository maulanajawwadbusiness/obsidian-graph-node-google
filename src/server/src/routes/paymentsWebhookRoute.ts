import crypto from "crypto";
import type express from "express";

type QueryResult = {
  rows: any[];
  rowCount?: number;
};

type QueryClient = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
  release: () => void;
};

type QueryablePool = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
  connect: () => Promise<QueryClient>;
};

export type PaymentsWebhookDeps = {
  getPool: () => Promise<QueryablePool>;
  verifyMidtransSignature: (payload: unknown) => boolean;
  applyTopupFromMidtrans: (args: {
    userId: string;
    orderId: string;
    amountIdr: number;
  }) => Promise<void>;
  isPaidStatus: (status: string | undefined) => boolean;
};

export function registerPaymentsWebhookRoute(
  app: express.Express,
  deps: PaymentsWebhookDeps
): void {
  app.post("/api/payments/webhook", async (req, res) => {
    const body = req.body ?? {};
    const now = new Date();
    const eventId = crypto.randomUUID();
    const orderId = body?.order_id ? String(body.order_id) : null;
    const transactionId = body?.transaction_id ? String(body.transaction_id) : null;
    const signatureKey = body?.signature_key ? String(body.signature_key) : null;
    const verified = deps.verifyMidtransSignature(body);

    try {
      const pool = await deps.getPool();
      await pool.query(
        `insert into payment_webhook_events
        (id, received_at, order_id, midtrans_transaction_id, raw_body, signature_key, is_verified, processed)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [eventId, now, orderId, transactionId, body, signatureKey, verified, false]
      );
    } catch (e) {
      res.status(200).json({ ok: false, error: "failed to store webhook" });
      return;
    }

    let processingError: string | null = null;
    let rupiahApplyError: string | null = null;
    let shouldApplyCredits = false;
    if (verified && orderId) {
      try {
        const pool = await deps.getPool();
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const status = body?.transaction_status ? String(body.transaction_status) : "unknown";
          const paidAt = deps.isPaidStatus(status) ? now : null;
          const updateResult = await client.query(
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
            [orderId, status, transactionId, body, now, paidAt]
          );
          if (updateResult.rowCount === 0) {
            processingError = "order not found";
          }
          if (paidAt) {
            shouldApplyCredits = true;
          }
          await client.query("COMMIT");
        } catch (e) {
          await client.query("ROLLBACK");
          processingError = "failed to update transaction";
        } finally {
          client.release();
        }
      } catch (e) {
        processingError = "failed to update transaction";
      }
    } else if (!verified) {
      processingError = "signature not verified";
    }

    if (!processingError && shouldApplyCredits && orderId) {
      try {
        const pool = await deps.getPool();
        const result = await pool.query(
          `select user_id, gross_amount
           from payment_transactions
          where order_id = $1`,
          [orderId]
        );
        const row = result.rows[0];
        if (row) {
          await deps.applyTopupFromMidtrans({
            userId: String(row.user_id),
            orderId,
            amountIdr: Number(row.gross_amount || 0)
          });
        } else {
          rupiahApplyError = "rupiah apply failed: missing transaction row";
        }
      } catch (e) {
        rupiahApplyError = "rupiah apply failed";
      }
    }

    if (!processingError && rupiahApplyError) {
      processingError = rupiahApplyError;
    }

    try {
      const pool = await deps.getPool();
      await pool.query(
        `update payment_webhook_events
         set processed = $2, processing_error = $3
       where id = $1`,
        [eventId, true, processingError]
      );
    } catch (e) {
      res.status(200).json({ ok: false, error: "failed to finalize webhook" });
      return;
    }

    res.status(200).json({ ok: true });
  });
}
