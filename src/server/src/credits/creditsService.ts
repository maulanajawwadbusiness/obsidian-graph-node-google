import crypto from "crypto";
import { getPool } from "../db";

export type CreditsBalance = {
  balance: number;
  updated_at: string;
};

export type CreditsApplyResult = {
  ok: true;
  balance_before: number;
  balance_after: number;
  applied: boolean;
};

export type CreditsErrorResult = {
  ok: false;
  code: "insufficient_credits";
  balance: number;
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
    `insert into credits_balances (user_id, balance, updated_at)
     values ($1, 0, now())
     on conflict (user_id) do nothing`,
    [userId]
  );
}

async function getBalanceForUpdate(client: any, userId: string) {
  const result = await client.query(
    `select balance
       from credits_balances
      where user_id = $1
      for update`,
    [userId]
  );
  if (result.rows.length === 0) {
    await ensureBalanceRow(client, userId);
    const retry = await client.query(
      `select balance
         from credits_balances
        where user_id = $1
        for update`,
      [userId]
    );
    return retry.rows[0];
  }
  return result.rows[0];
}

export async function getBalance(userId: string): Promise<CreditsBalance> {
  const pool = await getPool();
  await pool.query(
    `insert into credits_balances (user_id, balance, updated_at)
     values ($1, 0, now())
     on conflict (user_id) do nothing`,
    [userId]
  );
  const result = await pool.query(
    `select balance, updated_at
       from credits_balances
      where user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return {
    balance: Number(row?.balance ?? 0),
    updated_at: row?.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function applyTopupFromMidtrans(opts: {
  userId: string;
  orderId: string;
  amount: number;
}): Promise<CreditsApplyResult> {
  return withTransaction(async (client) => {
    const { userId, orderId, amount } = opts;
    await ensureBalanceRow(client, userId);
    const row = await getBalanceForUpdate(client, userId);
    const balanceBefore = Number(row?.balance ?? 0);

    const insertResult = await client.query(
      `insert into credits_ledger
        (id, user_id, delta, reason, ref_type, ref_id, created_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (reason, ref_type, ref_id) do nothing
       returning id`,
      [crypto.randomUUID(), userId, amount, "topup", "midtrans_order", orderId]
    );

    if (insertResult.rowCount === 0) {
      return {
        ok: true,
        balance_before: balanceBefore,
        balance_after: balanceBefore,
        applied: false
      };
    }

    const nextBalance = balanceBefore + amount;
    await client.query(
      `update credits_balances
          set balance = $2, updated_at = now()
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

export async function deductForLlm(opts: {
  userId: string;
  requestId: string;
  amount: number;
}): Promise<CreditsApplyResult | CreditsErrorResult> {
  return withTransaction(async (client) => {
    const { userId, requestId, amount } = opts;
    await ensureBalanceRow(client, userId);
    const row = await getBalanceForUpdate(client, userId);
    const balanceBefore = Number(row?.balance ?? 0);

    if (balanceBefore < amount) {
      return { ok: false, code: "insufficient_credits", balance: balanceBefore };
    }

    const insertResult = await client.query(
      `insert into credits_ledger
        (id, user_id, delta, reason, ref_type, ref_id, created_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (reason, ref_type, ref_id) do nothing
       returning id`,
      [crypto.randomUUID(), userId, -amount, "usage", "llm_request", requestId]
    );

    if (insertResult.rowCount === 0) {
      return {
        ok: true,
        balance_before: balanceBefore,
        balance_after: balanceBefore,
        applied: false
      };
    }

    const nextBalance = balanceBefore - amount;
    await client.query(
      `update credits_balances
          set balance = $2, updated_at = now()
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
