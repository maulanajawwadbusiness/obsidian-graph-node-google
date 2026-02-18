import { betaDailyWordLimit, betaPerDocWordLimit } from "./betaCapsConfig";
import { getTodayDateKey } from "./providerSelector";

type QueryResult = { rows: Array<Record<string, unknown>> };
type QueryableDb = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
};

export type BetaCapsViolationCode = "beta_cap_exceeded" | "beta_daily_exceeded";

export type BetaCapsCheckResult =
  | {
      ok: true;
      submittedWordCount: number;
      perDocLimit: number;
      dailyLimit: number;
      dailyUsed: number;
      dailyRemaining: number;
      dateKey: string;
      resetNote: string;
    }
  | {
      ok: false;
      code: BetaCapsViolationCode;
      submittedWordCount: number;
      perDocLimit: number;
      dailyLimit: number;
      dailyUsed: number;
      dailyRemaining: number;
      dateKey: string;
      resetNote: string;
    };

export function computeWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function getTodayKeyUTC(): string {
  return getTodayDateKey();
}

export async function getDailyUsedWords(db: QueryableDb, userId: string, dateKey: string): Promise<number> {
  const res = await db.query(
    `select used_words
       from beta_daily_word_usage
      where date_key = $1 and user_id = $2`,
    [dateKey, userId]
  );
  if (!Array.isArray(res.rows) || res.rows.length === 0) return 0;
  return Number(res.rows[0]?.used_words ?? 0);
}

export async function checkCaps(opts: {
  db: QueryableDb;
  userId: string;
  submittedWordCount: number;
  requestId: string;
  capsEnabled: boolean;
}): Promise<BetaCapsCheckResult> {
  const submittedWordCount = Math.max(0, Math.floor(opts.submittedWordCount));
  const dateKey = getTodayKeyUTC();
  const resetNote = "resets at 00:00 UTC (07:00 WIB)";

  if (!opts.capsEnabled) {
    return {
      ok: true,
      submittedWordCount,
      perDocLimit: betaPerDocWordLimit,
      dailyLimit: betaDailyWordLimit,
      dailyUsed: 0,
      dailyRemaining: betaDailyWordLimit,
      dateKey,
      resetNote
    };
  }

  const dailyUsed = await getDailyUsedWords(opts.db, opts.userId, dateKey);
  const projected = dailyUsed + submittedWordCount;
  const dailyRemaining = Math.max(0, betaDailyWordLimit - dailyUsed);
  if (submittedWordCount > betaPerDocWordLimit) {
    console.log(
      `[caps] check request_id=${opts.requestId} user_id=${opts.userId} code=beta_cap_exceeded submitted_words=${submittedWordCount} daily_used=${dailyUsed} date_key=${dateKey}`
    );
    return {
      ok: false,
      code: "beta_cap_exceeded",
      submittedWordCount,
      perDocLimit: betaPerDocWordLimit,
      dailyLimit: betaDailyWordLimit,
      dailyUsed,
      dailyRemaining,
      dateKey,
      resetNote
    };
  }

  if (projected > betaDailyWordLimit) {
    console.log(
      `[caps] check request_id=${opts.requestId} user_id=${opts.userId} code=beta_daily_exceeded submitted_words=${submittedWordCount} daily_used=${dailyUsed} date_key=${dateKey}`
    );
    return {
      ok: false,
      code: "beta_daily_exceeded",
      submittedWordCount,
      perDocLimit: betaPerDocWordLimit,
      dailyLimit: betaDailyWordLimit,
      dailyUsed,
      dailyRemaining,
      dateKey,
      resetNote
    };
  }

  console.log(
    `[caps] check request_id=${opts.requestId} user_id=${opts.userId} code=ok submitted_words=${submittedWordCount} daily_used=${dailyUsed} date_key=${dateKey}`
  );
  return {
    ok: true,
    submittedWordCount,
    perDocLimit: betaPerDocWordLimit,
    dailyLimit: betaDailyWordLimit,
    dailyUsed,
    dailyRemaining,
    dateKey,
    resetNote
  };
}

export async function recordUsage(opts: {
  db: QueryableDb;
  userId: string;
  dateKey: string;
  deltaWords: number;
  requestId: string;
  capsEnabled: boolean;
}): Promise<void> {
  const deltaWords = Math.max(0, Math.floor(opts.deltaWords));
  if (!opts.capsEnabled) return;
  if (deltaWords <= 0) return;

  const res = await opts.db.query(
    `insert into beta_daily_word_usage (date_key, user_id, used_words, updated_at)
     values ($1, $2, $3, now())
     on conflict (date_key, user_id)
     do update
       set used_words = beta_daily_word_usage.used_words + excluded.used_words,
           updated_at = now()
     returning used_words`,
    [opts.dateKey, opts.userId, deltaWords]
  );

  const newUsedWords = Number(res.rows[0]?.used_words ?? 0);
  console.log(
    `[caps] record request_id=${opts.requestId} user_id=${opts.userId} date_key=${opts.dateKey} delta_words=${deltaWords} used_words=${newUsedWords}`
  );
}
