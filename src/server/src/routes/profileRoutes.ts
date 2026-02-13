import express from "express";
import {
  AuthContext,
  PROFILE_DISPLAY_NAME_MAX,
  PROFILE_USERNAME_MAX,
  PROFILE_USERNAME_REGEX,
} from "../app/deps";
import { getPool } from "../db";
import { requireAuth } from "../middleware/requireAuth";

export function registerProfileRoutes(app: express.Express, getProfileColumnsAvailable: () => boolean) {
  app.post("/api/profile/update", requireAuth, async (req, res) => {
    if (!getProfileColumnsAvailable()) {
      res.status(503).json({ ok: false, error: "profile schema not ready; apply migration first" });
      return;
    }
    const user = res.locals.user as AuthContext;
    const displayNameRaw = req.body?.displayName;
    const usernameRaw = req.body?.username;

    if (typeof displayNameRaw !== "string" || typeof usernameRaw !== "string") {
      res.status(400).json({ ok: false, error: "displayName and username are required" });
      return;
    }

    const displayNameTrimmed = displayNameRaw.replace(/\s+/g, " ").trim();
    if (displayNameTrimmed.length > PROFILE_DISPLAY_NAME_MAX) {
      res.status(400).json({ ok: false, error: `displayName max length is ${PROFILE_DISPLAY_NAME_MAX}` });
      return;
    }
    const displayName = displayNameTrimmed.length > 0 ? displayNameTrimmed : null;

    const usernameTrimmed = usernameRaw.trim();
    if (usernameTrimmed.length > PROFILE_USERNAME_MAX) {
      res.status(400).json({ ok: false, error: `username max length is ${PROFILE_USERNAME_MAX}` });
      return;
    }
    if (usernameTrimmed.length > 0 && !PROFILE_USERNAME_REGEX.test(usernameTrimmed)) {
      res.status(400).json({ ok: false, error: "username allows only letters, numbers, underscore, dot, dash" });
      return;
    }
    const username = usernameTrimmed.length > 0 ? usernameTrimmed.toLowerCase() : null;

    try {
      const pool = await getPool();
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
          username: row.username ?? undefined,
        },
      });
    } catch {
      res.status(500).json({ ok: false, error: "failed to update profile" });
    }
  });
}
