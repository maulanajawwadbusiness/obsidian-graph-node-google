import { getPool } from "../db";

export async function recordTokenSpend(opts: {
  userId: string;
  dateKey: string;
  tokensUsed: number;
}): Promise<{ newUserUsed: number; newPoolRemaining: number }> {
  const tokens = Math.max(0, Math.trunc(opts.tokensUsed));
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `insert into openai_free_pool_daily (date_key, remaining_tokens, updated_at)
       values ($1, 0, now())
       on conflict (date_key) do nothing`,
      [opts.dateKey]
    );
    await client.query(
      `insert into openai_free_user_daily_usage (date_key, user_id, used_tokens, updated_at)
       values ($1, $2, 0, now())
       on conflict (date_key, user_id) do nothing`,
      [opts.dateKey, opts.userId]
    );

    const poolRes = await client.query(
      `update openai_free_pool_daily
          set remaining_tokens = greatest(remaining_tokens - $2, 0),
              updated_at = now()
        where date_key = $1
        returning remaining_tokens`,
      [opts.dateKey, tokens]
    );
    const userRes = await client.query(
      `update openai_free_user_daily_usage
          set used_tokens = used_tokens + $3,
              updated_at = now()
        where date_key = $1 and user_id = $2
        returning used_tokens`,
      [opts.dateKey, opts.userId, tokens]
    );

    await client.query("COMMIT");
    return {
      newPoolRemaining: Number(poolRes.rows[0]?.remaining_tokens ?? 0),
      newUserUsed: Number(userRes.rows[0]?.used_tokens ?? 0)
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
