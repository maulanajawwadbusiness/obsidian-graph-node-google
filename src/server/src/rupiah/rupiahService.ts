import crypto from "crypto";
import { getPool } from "../db";

export type RupiahBalance = {
  balance_idr: number;
  updated_at: string;
};

export type RupiahApplyResult = {
  ok: true;
  balance_before: number;
  balance_after: number;
  applied: boolean;
};

export type RupiahErrorResult = {
  ok: false;
  code: "insufficient_rupiah";
  balance_idr: number;
};

async function withTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function ensureBalanceRow(client: any, userId: string) {
  await client.query(
    `insert into rupiah_balances (user_id, balance_idr, updated_at)
     values ($1, 0, now())
     on conflict (user_id) do nothing`,
    [userId]
  );
}

async function getBalanceForUpdate(client: any, userId: string) {
  const result = await client.query(
    `select balance_idr
       from rupiah_balances
      where user_id = $1
      for update`,
    [userId]
  );
  if (result.rows.length === 0) {
    await ensureBalanceRow(client, userId);
    const retry = await client.query(
      `select balance_idr
         from rupiah_balances
        where user_id = $1
        for update`,
      [userId]
    );
    return retry.rows[0];
  }
  return result.rows[0];
}

export async function getBalance(userId: string): Promise<RupiahBalance> {
  const pool = await getPool();
  await pool.query(
    `insert into rupiah_balances (user_id, balance_idr, updated_at)
     values ($1, 0, now())
     on conflict (user_id) do nothing`,
    [userId]
  );
  const result = await pool.query(
    `select balance_idr, updated_at
       from rupiah_balances
      where user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return {
    balance_idr: Number(row?.balance_idr ?? 0),
    updated_at: row?.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function applyTopupFromMidtrans(opts: {
  userId: string;
  orderId: string;
  amountIdr: number;
}): Promise<RupiahApplyResult> {
  return withTransaction(async (client) => {
    const { userId, orderId, amountIdr } = opts;
    await ensureBalanceRow(client, userId);
    const row = await getBalanceForUpdate(client, userId);
    const balanceBefore = Number(row?.balance_idr ?? 0);

    const insertResult = await client.query(
      `insert into rupiah_ledger
        (id, user_id, delta_idr, reason, ref_type, ref_id, created_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (reason, ref_type, ref_id) do nothing
       returning id`,
      [crypto.randomUUID(), userId, amountIdr, "topup", "midtrans_order", orderId]
    );

    if (insertResult.rowCount === 0) {
      return {
        ok: true,
        balance_before: balanceBefore,
        balance_after: balanceBefore,
        applied: false
      };
    }

    const nextBalance = balanceBefore + amountIdr;
    await client.query(
      `update rupiah_balances
          set balance_idr = $2, updated_at = now()
        where user_id = $1`,
      [userId, nextBalance]
    );

    return {
      ok: true,
      balance_before: balanceBefore,
      balance_after: nextBalance,
      applied: true
    };
  });
}

export async function chargeForLlm(opts: {
  userId: string;
  requestId: string;
  amountIdr: number;
  meta: { model: string; totalTokens: number };
}): Promise<RupiahApplyResult | RupiahErrorResult> {
  return withTransaction(async (client) => {
    const { userId, requestId, amountIdr } = opts;
    await ensureBalanceRow(client, userId);
    const row = await getBalanceForUpdate(client, userId);
    const balanceBefore = Number(row?.balance_idr ?? 0);

    if (balanceBefore < amountIdr) {
      return { ok: false, code: "insufficient_rupiah", balance_idr: balanceBefore };
    }

    const insertResult = await client.query(
      `insert into rupiah_ledger
        (id, user_id, delta_idr, reason, ref_type, ref_id, created_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (reason, ref_type, ref_id) do nothing
       returning id`,
      [crypto.randomUUID(), userId, -amountIdr, "usage", "llm_request", requestId]
    );

    if (insertResult.rowCount === 0) {
      return {
        ok: true,
        balance_before: balanceBefore,
        balance_after: balanceBefore,
        applied: false
      };
    }

    const nextBalance = balanceBefore - amountIdr;
    await client.query(
      `update rupiah_balances
          set balance_idr = $2, updated_at = now()
        where user_id = $1`,
      [userId, nextBalance]
    );

    return {
      ok: true,
      balance_before: balanceBefore,
      balance_after: nextBalance,
      applied: true
    };
  });
}
