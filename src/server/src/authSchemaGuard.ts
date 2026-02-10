import { getPool } from "./db";

type ColumnRow = {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
};

type AuthSchemaSummary = {
  dbTarget: string;
  tables: string[];
  columnsByTable: Record<string, Array<{ name: string; dataType: string; udtName: string }>>;
  hasSessionsUserFk: boolean;
  hasUsersGoogleSubUnique: boolean;
  hasSessionsIdUnique: boolean;
};

const REQUIRED_TABLES = ["users", "sessions"] as const;
const REQUIRED_COLUMNS: Record<(typeof REQUIRED_TABLES)[number], string[]> = {
  users: ["id", "google_sub", "email", "name", "picture"],
  sessions: ["id", "user_id", "expires_at"],
};

function getDbTargetLabel() {
  const instance = (process.env.INSTANCE_CONNECTION_NAME || "").trim();
  const dbName = (process.env.DB_NAME || "").trim();
  const instanceLabel = instance || "<missing-instance-connection-name>";
  const dbLabel = dbName || "<missing-db-name>";
  return `${instanceLabel}/${dbLabel}`;
}

function normalizeDataType(row: ColumnRow) {
  return `${row.data_type}|${row.udt_name}`.toLowerCase();
}

function isTypeCompatible(tableName: string, columnName: string, row: ColumnRow): boolean {
  const type = normalizeDataType(row);
  if (tableName === "users" && columnName === "id") {
    return type.includes("bigint|int8");
  }
  if (tableName === "users" && columnName === "google_sub") {
    return type.includes("text|text") || type.includes("character varying|varchar");
  }
  if (tableName === "sessions" && columnName === "id") {
    return type.includes("uuid|uuid");
  }
  if (tableName === "sessions" && columnName === "user_id") {
    return type.includes("bigint|int8");
  }
  if (tableName === "sessions" && columnName === "expires_at") {
    return type.includes("timestamp");
  }
  return true;
}

async function hasUniqueIndexOnSingleColumn(tableName: string, columnName: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.query(
    `
    select exists (
      select 1
      from pg_class t
      join pg_namespace n on n.oid = t.relnamespace
      join pg_index i on i.indrelid = t.oid
      join pg_attribute a on a.attrelid = t.oid and a.attnum = any(i.indkey)
      where n.nspname = 'public'
        and t.relname = $1
        and i.indisunique = true
      group by i.indexrelid
      having count(*) = 1 and bool_or(a.attname = $2)
    ) as ok
    `,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.ok);
}

async function hasSessionsUserFkConstraint(): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.query(
    `
    select exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.constraint_schema = kcu.constraint_schema
      join information_schema.constraint_column_usage ccu
        on tc.constraint_name = ccu.constraint_name
       and tc.constraint_schema = ccu.constraint_schema
      where tc.table_schema = 'public'
        and tc.table_name = 'sessions'
        and tc.constraint_type = 'FOREIGN KEY'
        and kcu.column_name = 'user_id'
        and ccu.table_schema = 'public'
        and ccu.table_name = 'users'
        and ccu.column_name = 'id'
    ) as ok
    `
  );
  return Boolean(result.rows[0]?.ok);
}

function buildColumnsByTable(rows: ColumnRow[]) {
  const out: Record<string, Array<{ name: string; dataType: string; udtName: string }>> = {};
  for (const row of rows) {
    if (!out[row.table_name]) out[row.table_name] = [];
    out[row.table_name].push({
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
    });
  }
  return out;
}

export async function assertAuthSchemaReady(): Promise<AuthSchemaSummary> {
  const pool = await getPool();
  const dbTarget = getDbTargetLabel();

  const columnResult = await pool.query<ColumnRow>(
    `
    select table_name, column_name, data_type, udt_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any($1::text[])
    order by table_name, ordinal_position
    `,
    [REQUIRED_TABLES]
  );
  const rows = columnResult.rows || [];
  const tableSet = new Set(rows.map((row) => row.table_name));
  const missingTables = REQUIRED_TABLES.filter((tableName) => !tableSet.has(tableName));

  const missingColumns: string[] = [];
  const incompatibleColumns: string[] = [];
  for (const tableName of REQUIRED_TABLES) {
    const tableRows = rows.filter((row) => row.table_name === tableName);
    const colSet = new Set(tableRows.map((row) => row.column_name));
    for (const requiredColumn of REQUIRED_COLUMNS[tableName]) {
      if (!colSet.has(requiredColumn)) {
        missingColumns.push(`${tableName}.${requiredColumn}`);
        continue;
      }
      const row = tableRows.find((item) => item.column_name === requiredColumn);
      if (!row) continue;
      if (!isTypeCompatible(tableName, requiredColumn, row)) {
        incompatibleColumns.push(
          `${tableName}.${requiredColumn} type=${row.data_type}/${row.udt_name}`
        );
      }
    }
  }

  const hasSessionsUserFk = await hasSessionsUserFkConstraint();
  const hasUsersGoogleSubUnique = await hasUniqueIndexOnSingleColumn("users", "google_sub");
  const hasSessionsIdUnique = await hasUniqueIndexOnSingleColumn("sessions", "id");

  const errors: string[] = [];
  if (missingTables.length > 0) {
    errors.push(`missing tables: ${missingTables.join(", ")}`);
  }
  if (missingColumns.length > 0) {
    errors.push(`missing columns: ${missingColumns.join(", ")}`);
  }
  if (incompatibleColumns.length > 0) {
    errors.push(`incompatible column types: ${incompatibleColumns.join(", ")}`);
  }
  if (!hasSessionsUserFk) {
    errors.push("missing FK: sessions.user_id -> users.id");
  }
  if (!hasUsersGoogleSubUnique) {
    errors.push("missing unique index/constraint on users.google_sub");
  }
  if (!hasSessionsIdUnique) {
    errors.push("missing unique index/constraint on sessions.id");
  }

  const summary: AuthSchemaSummary = {
    dbTarget,
    tables: Array.from(tableSet).sort(),
    columnsByTable: buildColumnsByTable(rows),
    hasSessionsUserFk,
    hasUsersGoogleSubUnique,
    hasSessionsIdUnique,
  };

  if (errors.length > 0) {
    throw new Error(`[auth-schema] invalid (${dbTarget}) ${errors.join(" | ")}`);
  }
  return summary;
}

async function runCliCheck() {
  try {
    const summary = await assertAuthSchemaReady();
    console.log(
      `[auth-schema] ok db=${summary.dbTarget} tables=${summary.tables.join(",")} fk_sessions_user=${summary.hasSessionsUserFk} uq_users_google_sub=${summary.hasUsersGoogleSubUnique} uq_sessions_id=${summary.hasSessionsIdUnique}`
    );
    process.exitCode = 0;
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void runCliCheck();
}

