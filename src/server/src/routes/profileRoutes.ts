import type express from "express";

type QueryResult = {
  rows: any[];
  rowCount?: number;
};

type QueryablePool = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
};

export type ProfileRouteDeps = {
  getPool: () => Promise<QueryablePool>;
  requireAuth: express.RequestHandler;
  getProfileColumnsAvailable: () => boolean;
  profileDisplayNameMax: number;
  profileUsernameMax: number;
  profileUsernameRegex: RegExp;
};

export function registerProfileRoutes(app: express.Express, deps: ProfileRouteDeps): void {
  app.post("/api/profile/update", deps.requireAuth, async (req, res) => {
    if (!deps.getProfileColumnsAvailable()) {
      res.status(503).json({ ok: false, error: "profile schema not ready; apply migration first" });
      return;
    }

    const user = res.locals.user as { id: string };
    const displayNameRaw = req.body?.displayName;
    const usernameRaw = req.body?.username;

    if (typeof displayNameRaw !== "string" || typeof usernameRaw !== "string") {
      res.status(400).json({ ok: false, error: "displayName and username are required" });
      return;
    }

    const displayNameTrimmed = displayNameRaw.replace(/\s+/g, " ").trim();
    if (displayNameTrimmed.length > deps.profileDisplayNameMax) {
      res.status(400).json({
        ok: false,
        error: `displayName max length is ${deps.profileDisplayNameMax}`
      });
      return;
    }
    const displayName = displayNameTrimmed.length > 0 ? displayNameTrimmed : null;

    const usernameTrimmed = usernameRaw.trim();
    if (usernameTrimmed.length > deps.profileUsernameMax) {
      res.status(400).json({
        ok: false,
        error: `username max length is ${deps.profileUsernameMax}`
      });
      return;
    }
    if (usernameTrimmed.length > 0 && !deps.profileUsernameRegex.test(usernameTrimmed)) {
      res.status(400).json({
        ok: false,
        error: "username may only contain letters, numbers, dot, underscore, and dash"
      });
      return;
    }
    const username = usernameTrimmed.length > 0 ? usernameTrimmed : null;

    try {
      const pool = await deps.getPool();
      const result = await pool.query(
        `update users
            set display_name = $2,
                username = $3
          where id = $1
        returning google_sub, email, name, picture, display_name, username`,
        [user.id, displayName, username]
      );
      const row = result.rows[0];
      if (!row) {
        res.status(404).json({ ok: false, error: "user not found" });
        return;
      }
      res.json({
        ok: true,
        user: {
          sub: row.google_sub,
          email: row.email ?? undefined,
          name: row.name ?? undefined,
          picture: row.picture ?? undefined,
          displayName: row.display_name ?? undefined,
          username: row.username ?? undefined
        }
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: "failed to update profile" });
    }
  });
}
