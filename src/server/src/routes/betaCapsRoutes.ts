import type express from "express";
import { betaDailyWordLimit } from "../llm/betaCapsConfig";
import { getDailyUsedWords, getTodayKeyUTC } from "../llm/betaCaps";
import type { AuthContext } from "./llmRouteDeps";

type QueryResult = { rows: any[]; rowCount?: number };
type QueryablePool = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
};

export type BetaCapsRouteDeps = {
  getPool: () => Promise<QueryablePool>;
  requireAuth: express.RequestHandler;
  getUserId: (user: AuthContext) => string;
  isBetaCapsModeEnabled: () => boolean;
};

export function registerBetaCapsRoutes(app: express.Express, deps: BetaCapsRouteDeps): void {
  app.get("/api/beta/usage/today", deps.requireAuth, async (_req, res) => {
    const dateKey = getTodayKeyUTC();
    const resetNote = "resets at 00:00 UTC (07:00 WIB)";
    const capsEnabled = deps.isBetaCapsModeEnabled();
    if (!capsEnabled) {
      res.json({
        date_key: dateKey,
        daily_limit: betaDailyWordLimit,
        used_words: 0,
        remaining_words: betaDailyWordLimit,
        reset_note: resetNote,
        caps_enabled: false
      });
      return;
    }

    try {
      const user = res.locals.user as AuthContext;
      const userId = deps.getUserId(user);
      const pool = await deps.getPool();
      const usedWords = await getDailyUsedWords(pool, userId, dateKey);
      const remainingWords = Math.max(0, betaDailyWordLimit - usedWords);
      res.json({
        date_key: dateKey,
        daily_limit: betaDailyWordLimit,
        used_words: usedWords,
        remaining_words: remainingWords,
        reset_note: resetNote,
        caps_enabled: true
      });
    } catch {
      res.status(500).json({ ok: false, error: "failed to read beta usage" });
    }
  });
}
