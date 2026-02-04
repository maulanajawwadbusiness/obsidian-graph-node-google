import express from "express";
import { getPool } from "./db";

const app = express();
const port = Number(process.env.PORT || 8080);

app.get("/health", async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(port, () => {
  console.log(`[server] listening on ${port}`);
});
