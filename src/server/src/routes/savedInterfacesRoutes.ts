import type express from "express";

type QueryResult = {
  rows: any[];
  rowCount?: number;
};

type QueryablePool = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
};

export type SavedInterfacesRouteDeps = {
  getPool: () => Promise<QueryablePool>;
  requireAuth: express.RequestHandler;
  listLimit: number;
  maxPayloadBytes: number;
  logger?: Pick<Console, "log" | "warn" | "error">;
};

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function registerSavedInterfacesRoutes(
  app: express.Express,
  deps: SavedInterfacesRouteDeps
): void {
  const logger = deps.logger ?? console;

  app.get("/api/saved-interfaces", deps.requireAuth, async (_req, res) => {
    const user = res.locals.user as { id: string };
    try {
      const pool = await deps.getPool();
      const result = await pool.query(
        `select client_interface_id, title, payload_version, payload_json, created_at, updated_at
         from saved_interfaces
        where user_id = $1
        order by updated_at desc
        limit $2`,
        [user.id, deps.listLimit]
      );
      const items = result.rows.map((row) => ({
        client_interface_id: String(row.client_interface_id),
        title: String(row.title),
        payload_version: Number(row.payload_version),
        payload_json: row.payload_json,
        created_at: toIsoString(row.created_at),
        updated_at: toIsoString(row.updated_at)
      }));
      logger.log(`[saved-interfaces] list user_id=${user.id} count=${items.length}`);
      res.json({ ok: true, items });
    } catch (e) {
      res.status(500).json({ ok: false, error: "failed to load saved interfaces" });
    }
  });

  app.post("/api/saved-interfaces/upsert", deps.requireAuth, async (req, res) => {
    const user = res.locals.user as { id: string };
    const clientInterfaceIdRaw = req.body?.clientInterfaceId;
    const titleRaw = req.body?.title;
    const payloadVersionRaw = req.body?.payloadVersion;
    const payloadJson = req.body?.payloadJson;

    const clientInterfaceId =
      typeof clientInterfaceIdRaw === "string" ? clientInterfaceIdRaw.trim() : "";
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

    if (payloadBytes > deps.maxPayloadBytes) {
      res.status(413).json({ ok: false, error: "saved interface payload too large" });
      return;
    }

    try {
      const pool = await deps.getPool();
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
      logger.log(
        `[saved-interfaces] upsert user_id=${user.id} client_interface_id=${clientInterfaceId} payload_bytes=${payloadBytes}`
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: "failed to upsert saved interface" });
    }
  });

  app.post("/api/saved-interfaces/delete", deps.requireAuth, async (req, res) => {
    const user = res.locals.user as { id: string };
    const clientInterfaceIdRaw = req.body?.clientInterfaceId;
    const clientInterfaceId =
      typeof clientInterfaceIdRaw === "string" ? clientInterfaceIdRaw.trim() : "";
    if (!clientInterfaceId) {
      res.status(400).json({ ok: false, error: "clientInterfaceId is required" });
      return;
    }

    try {
      const pool = await deps.getPool();
      const result = await pool.query(
        `delete from saved_interfaces
        where user_id = $1 and client_interface_id = $2`,
        [user.id, clientInterfaceId]
      );
      const deleted = (result.rowCount || 0) > 0;
      logger.log(
        `[saved-interfaces] delete user_id=${user.id} client_interface_id=${clientInterfaceId} deleted=${deleted}`
      );
      res.json({ ok: true, deleted });
    } catch (e) {
      res.status(500).json({ ok: false, error: "failed to delete saved interface" });
    }
  });
}
