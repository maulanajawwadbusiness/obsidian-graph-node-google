import crypto from "crypto";
import { getPool } from "../db";
import { DATE_KEY_TZ, OPENAI_DAILY_FREE_POOL_TOKENS, OPENAI_FREE_USERS_PER_DAY, OPENAI_FREE_TOKENS_PER_USER_PER_DAY } from "./providerPolicyConfig";

type ProviderChoice = {
  provider: "openai" | "openrouter";
  reason: "free_user" | "pool_exhausted" | "not_selected" | "cap_exceeded";
  remaining_tokens: number;
  is_free_user: boolean;
  user_used_tokens: number;
  user_cap: number;
  date_key: string;
};

function getDateKeyUtc(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateKey(): string {
  if (DATE_KEY_TZ === "UTC") return getDateKeyUtc();
  return getDateKeyUtc();
}

function hashToScore(value: string): number {
  const hash = crypto.createHash("sha256").update(value).digest("hex");
  const slice = hash.slice(0, 8);
  return parseInt(slice, 16);
}

function isSelectedFreeUser(userId: string, dateKey: string): boolean {
  const score = hashToScore(`${userId}:${dateKey}`);
  const bucket = score % 100000;
  return bucket < OPENAI_FREE_USERS_PER_DAY;
}

export async function getOrInitPool(dateKey: string): Promise<number> {
  const pool = await getPool();
  const result = await pool.query(
    `insert into openai_free_pool_daily (date_key, remaining_tokens, updated_at)
     values ($1, $2, now())
     on conflict (date_key)
     do update set updated_at = now()
     returning remaining_tokens`,
    [dateKey, OPENAI_DAILY_FREE_POOL_TOKENS]
  );
  return Number(result.rows[0]?.remaining_tokens ?? OPENAI_DAILY_FREE_POOL_TOKENS);
}

export async function checkRemaining(dateKey: string): Promise<number> {
  const pool = await getPool();
  const res = await pool.query(
    `select remaining_tokens
       from openai_free_pool_daily
      where date_key = $1`,
    [dateKey]
  );
  if (res.rows.length === 0) {
    return getOrInitPool(dateKey);
  }
  return Number(res.rows[0]?.remaining_tokens ?? OPENAI_DAILY_FREE_POOL_TOKENS);
}

export async function getOrInitUserUsage(dateKey: string, userId: string): Promise<number> {
  const pool = await getPool();
  const res = await pool.query(
    `insert into openai_free_user_daily_usage (date_key, user_id, used_tokens, updated_at)
     values ($1, $2, 0, now())
     on conflict (date_key, user_id)
     do update set updated_at = now()
     returning used_tokens`,
    [dateKey, userId]
  );
  return Number(res.rows[0]?.used_tokens ?? 0);
}

export async function selectProvider(opts: {
  userId: string;
  dateKey?: string;
  endpointKind?: "chat" | "analyze" | "prefill";
}): Promise<ProviderChoice> {
  const dateKey = opts.dateKey || getTodayDateKey();
  const remaining = await checkRemaining(dateKey);
  const usedTokens = await getOrInitUserUsage(dateKey, opts.userId);
  const cap = OPENAI_FREE_TOKENS_PER_USER_PER_DAY;
  if (remaining <= 0) {
    return {
      provider: "openrouter",
      reason: "pool_exhausted",
      remaining_tokens: remaining,
      is_free_user: false,
      user_used_tokens: usedTokens,
      user_cap: cap,
      date_key: dateKey
    };
  }

  const isFreeUser = isSelectedFreeUser(opts.userId, dateKey);
  if (isFreeUser) {
    if (usedTokens >= cap) {
      return {
        provider: "openrouter",
        reason: "cap_exceeded",
        remaining_tokens: remaining,
        is_free_user: true,
        user_used_tokens: usedTokens,
        user_cap: cap,
        date_key: dateKey
      };
    }
    return {
      provider: "openai",
      reason: "free_user",
      remaining_tokens: remaining,
      is_free_user: true,
      user_used_tokens: usedTokens,
      user_cap: cap,
      date_key: dateKey
    };
  }

  return {
    provider: "openrouter",
    reason: "not_selected",
    remaining_tokens: remaining,
    is_free_user: false,
    user_used_tokens: usedTokens,
    user_cap: cap,
    date_key: dateKey
  };
}
