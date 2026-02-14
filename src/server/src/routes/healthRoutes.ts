import type express from "express";

type QueryablePool = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

export type HealthRouteDeps = {
  getPool: () => Promise<QueryablePool>;
};

export function registerHealthRoutes(app: express.Express, deps: HealthRouteDeps): void {
  app.get("/health", async (_req, res) => {
    try {
      const pool = await deps.getPool();
      await pool.query("SELECT 1");
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
}
