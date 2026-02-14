export type AuthSchemaReadyResult = {
  dbTarget: string;
  tables: string[];
  hasSessionsUserFk: boolean;
  hasUsersGoogleSubUnique: boolean;
  hasSessionsIdUnique: boolean;
};

type QueryablePool = {
  query: (
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: Array<{ column_name?: unknown }> }>;
};

export type StartupGatesDeps = {
  assertAuthSchemaReady: () => Promise<AuthSchemaReadyResult>;
  getPool: () => Promise<QueryablePool>;
  logger?: Pick<Console, "log" | "error">;
};

export async function detectProfileColumnsAvailability(
  getPoolFn: StartupGatesDeps["getPool"]
): Promise<boolean> {
  const pool = await getPoolFn();
  const result = await pool.query(
    `select column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = 'users'
        and column_name in ('display_name', 'username')`
  );
  const found = new Set((result.rows || []).map((row) => String(row.column_name)));
  return found.has("display_name") && found.has("username");
}

export async function runStartupGates(deps: StartupGatesDeps): Promise<{
  schema: AuthSchemaReadyResult;
  profileColumnsAvailable: boolean;
}> {
  const logger = deps.logger ?? console;
  const schema = await deps.assertAuthSchemaReady();
  const profileColumnsAvailable = await detectProfileColumnsAvailability(deps.getPool);
  logger.log(
    `[auth-schema] ready db=${schema.dbTarget} tables=${schema.tables.join(",")} fk_sessions_user=${schema.hasSessionsUserFk} uq_users_google_sub=${schema.hasUsersGoogleSubUnique} uq_sessions_id=${schema.hasSessionsIdUnique}`
  );
  logger.log(`[auth-schema] profile_columns_available=${profileColumnsAvailable}`);
  return { schema, profileColumnsAvailable };
}
