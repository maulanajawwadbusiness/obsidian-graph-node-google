import { assertAuthSchemaReady } from "./authSchemaGuard";
import { createApp } from "./app/createApp";
import { detectProfileColumnsAvailability, isProd } from "./app/deps";

const port = Number(process.env.PORT || 8080);
const serverEntrypoint = process.argv[1] || __filename;

let profileColumnsAvailable = false;

async function startServer() {
  const { app, adminAllowlist, feedbackRouteRegistration } = createApp(() => profileColumnsAvailable);
  const allowDevBootWithoutDb = !isProd() && process.env.ALLOW_DEV_START_WITHOUT_DB !== "0";

  const feedbackRoutesReady =
    feedbackRouteRegistration.submit &&
    feedbackRouteRegistration.list &&
    feedbackRouteRegistration.updateStatus;

  console.log(`[server-boot] entrypoint=${serverEntrypoint} port=${port}`);
  console.log(`[server-boot] routes registered: feedback=${feedbackRoutesReady ? "yes" : "no"}`);
  if (!feedbackRoutesReady) {
    console.error("[server-boot] fatal: feedback routes are not fully registered");
    process.exit(1);
    return;
  }

  try {
    const schema = await assertAuthSchemaReady();
    profileColumnsAvailable = await detectProfileColumnsAvailability();
    console.log(`[admin] allowlist loaded count=${adminAllowlist.size}`);
    console.log(
      `[auth-schema] ready db=${schema.dbTarget} tables=${schema.tables.join(",")} fk_sessions_user=${schema.hasSessionsUserFk} uq_users_google_sub=${schema.hasUsersGoogleSubUnique} uq_sessions_id=${schema.hasSessionsIdUnique}`
    );
    console.log(`[auth-schema] profile_columns_available=${profileColumnsAvailable}`);
    app.listen(port, () => {
      console.log(`[server] listening on ${port}`);
    });
  } catch (error) {
    if (!allowDevBootWithoutDb) {
      console.error(`[server-boot] db bootstrap failed: mode=fatal err=${String(error)}`);
      console.error(`[auth-schema] fatal startup failure: ${String(error)}`);
      process.exit(1);
      return;
    }

    profileColumnsAvailable = false;
    console.warn(`[server-boot] db bootstrap failed: mode=degraded err=${String(error)}`);
    console.warn(`[auth-schema] startup degraded mode enabled: ${String(error)}`);
    console.warn("[auth-schema] continuing boot in dev without DB readiness checks");
    console.log(`[admin] allowlist loaded count=${adminAllowlist.size}`);
    app.listen(port, () => {
      console.log(`[server] listening on ${port} (degraded mode)`);
    });
  }
}

void startServer();
