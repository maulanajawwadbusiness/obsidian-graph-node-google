import express from "express";
import {
  AuthContext,
  MAX_SAVED_INTERFACE_PAYLOAD_BYTES,
  SAVED_INTERFACES_LIST_LIMIT,
} from "../app/deps";
import { getPool } from "../db";
import { requireAuth } from "../middleware/requireAuth";

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

export function registerSavedInterfacesRoutes(app: express.Express) {
  app.get("/api/saved-interfaces", requireAuth, async (_req, res) => {
    const user = res.locals.user as AuthContext;
    try {
      const pool = await getPool();
      const result = await pool.query(
        `select client_interface_id, title, payload_version, payload_json, created_at, updated_at
         from saved_interfaces
        where user_id = $1
        order by updated_at desc
        limit $2`,
        [user.id, SAVED_INTERFACES_LIST_LIMIT]
      );
      const items = result.rows.map((row) => ({
        client_interface_id: String(row.client_interface_id),
        title: String(row.title),
        payload_version: Number(row.payload_version),
        payload_json: row.payload_json,
        created_at: toIsoString(row.created_at),
        updated_at: toIsoString(row.updated_at),
      }));
      console.log(`[saved-interfaces] list user_id=${user.id} count=${items.length}`);
      res.json({ ok: true, items });
    } catch {
      res.status(500).json({ ok: false, error: "failed to load saved interfaces" });
    }
  });

  app.post("/api/saved-interfaces/upsert", requireAuth, async (req, res) => {
    const user = res.locals.user as AuthContext;
    const clientInterfaceIdRaw = req.body?.clientInterfaceId;
    const titleRaw = req.body?.title;
    const payloadVersionRaw = req.body?.payloadVersion;
    const payloadJson = req.body?.payloadJson;

    const clientInterfaceId = typeof clientInterfaceIdRaw === "string" ? clientInterfaceIdRaw.trim() : "";
    const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
    const payloadVersion = Number(payloadVersionRaw);

    if (!clientInterfaceId) {
      res.status(400).json({ ok: false, error: "clientInterfaceId is required" });
      return;
    }
    if (!title) {
      res.status(400).json({ ok: false, error: "title is required" });
      return;
    }
    if (!Number.isFinite(payloadVersion) || !Number.isInteger(payloadVersion) || payloadVersion < 1) {
      res.status(400).json({ ok: false, error: "payloadVersion must be a positive integer" });
      return;
    }
    if (payloadJson === null || payloadJson === undefined || typeof payloadJson !== "object") {
      res.status(400).json({ ok: false, error: "payloadJson must be an object" });
      return;
    }

    let payloadBytes = 0;
    try {
      payloadBytes = Buffer.byteLength(JSON.stringify(payloadJson), "utf8");
    } catch {
      res.status(400).json({ ok: false, error: "payloadJson is not serializable" });
      return;
    }

    if (payloadBytes > MAX_SAVED_INTERFACE_PAYLOAD_BYTES) {
      res.status(413).json({ ok: false, error: "saved interface payload too large" });
      return;
    }

    try {
      const pool = await getPool();
      await pool.query(
        `insert into saved_interfaces
        (user_id, client_interface_id, title, payload_version, payload_json)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, client_interface_id)
       do update set
         title = excluded.title,
         payload_version = excluded.payload_version,
         payload_json = excluded.payload_json,
         updated_at = now()`,
        [user.id, clientInterfaceId, title, payloadVersion, payloadJson]
      );
      console.log(
        `[saved-interfaces] upsert user_id=${user.id} client_interface_id=${clientInterfaceId} payload_bytes=${payloadBytes}`
      );
      res.json({ ok: true });
    } catch {
      res.status(500).json({ ok: false, error: "failed to upsert saved interface" });
    }
  });

  app.post("/api/saved-interfaces/delete", requireAuth, async (req, res) => {
    const user = res.locals.user as AuthContext;
    const clientInterfaceIdRaw = req.body?.clientInterfaceId;
    const clientInterfaceId = typeof clientInterfaceIdRaw === "string" ? clientInterfaceIdRaw.trim() : "";
    if (!clientInterfaceId) {
      res.status(400).json({ ok: false, error: "clientInterfaceId is required" });
      return;
    }

    try {
      const pool = await getPool();
      const result = await pool.query(
        `delete from saved_interfaces
        where user_id = $1 and client_interface_id = $2`,
        [user.id, clientInterfaceId]
      );
      const deleted = (result.rowCount || 0) > 0;
      console.log(
        `[saved-interfaces] delete user_id=${user.id} client_interface_id=${clientInterfaceId} deleted=${deleted}`
      );
      res.json({ ok: true, deleted });
    } catch {
      res.status(500).json({ ok: false, error: "failed to delete saved interface" });
    }
  });
}
