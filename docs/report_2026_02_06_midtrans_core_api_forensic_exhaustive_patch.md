# Midtrans Core API Forensic Report (Exhaustive Patch)
**Date**: 2026-02-06
**Agent**: Claude Sonnet 4.5 (Maulana Core Mode)
**Mission**: Patch missing anchors and correct external assumptions in exhaustive forensic scan
**Status**: SCAN COMPLETE. ZERO CODE CHANGES MADE.

---

## PURPOSE OF THIS PATCH

This patch adds missing anchors to `docs/report_2026_02_06_midtrans_core_api_forensic_exhaustive.md` and corrects claims that lacked proper evidence.

**What this patch adds**:
1. **Script file anchors** - All 8 database scripts opened and analyzed
2. **Env file anchors** - .env, .env.local, .gitignore with line ranges
3. **node-pg-migrate configuration truth** - Verified defaults and DATABASE_URL behavior
4. **External knowledge labeled** - Pg defaults, Express defaults, Midtrans assumptions moved to implications
5. **Webhook+CORS risk verified** - Confirmed no existing webhook handlers

---

## SECTION 1: SCRIPT FILES - FULL ANCHORS

### Script 1: db-env.ps1 (Env Var Helpers)

**File**: `src/server/scripts/db-env.ps1`
**Lines**: 1-18
```powershell
$ErrorActionPreference = "Stop"

function Require-Env($name) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not $value) {
        throw "Missing environment variable: $name"
    }
    return $value
}

function Get-DbConnString {
    $dbName = Require-Env "DB_NAME"
    $dbUser = Require-Env "DB_USER"
    $dbPassword = Require-Env "DB_PASSWORD"

    $env:PGPASSWORD = $dbPassword
    return "host=127.0.0.1 port=5432 dbname=$dbName user=$dbUser sslmode=disable"
}
```
**Fact**: Provides helper functions for other scripts.
- **Env vars read**: `DB_NAME`, `DB_USER`, `DB_PASSWORD` (lines 12-14)
- **Output**: PostgreSQL connection string (line 17)
- **Commands run**: None (helper functions only)

---

### Script 2: db-proxy.ps1 (Start Cloud SQL Auth Proxy)

**File**: `src/server/scripts/db-proxy.ps1`
**Lines**: 1-9
```powershell
$ErrorActionPreference = "Stop"

$instance = [Environment]::GetEnvironmentVariable("INSTANCE_CONNECTION_NAME")
if (-not $instance) {
    throw "Missing environment variable: INSTANCE_CONNECTION_NAME"
}

Write-Host "Starting Cloud SQL Auth Proxy on 127.0.0.1:5432..."
cloud-sql-proxy $instance --port 5432
```
**Fact**: Starts Cloud SQL Auth Proxy to forward 127.0.0.1:5432 to Cloud SQL.
- **Env vars read**: `INSTANCE_CONNECTION_NAME` (line 3)
- **Commands run**: `cloud-sql-proxy` with instance name (line 9)
- **SQL files**: None touched (binary proxy tool)

---

### Script 3: db-psql.ps1 (Open psql Shell)

**File**: `src/server/scripts/db-psql.ps1`
**Lines**: 1-6
```powershell
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
Write-Host "Opening psql..."
psql $conn
```
**Fact**: Opens interactive psql shell.
- **Env vars read**: Via `db-env.ps1` (`DB_NAME`, `DB_USER`, `DB_PASSWORD`)
- **Commands run**: `psql` with connection string (line 6)
- **SQL files**: None touched (interactive shell)

---

### Script 4: db-ping.ps1 (Ping Database)

**File**: `src/server/scripts/db-ping.ps1`
**Lines**: 1-5
```powershell
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
psql $conn -c "select now();"
```
**Fact**: Tests database connectivity.
- **Env vars read**: Via `db-env.ps1`
- **Commands run**: `psql` with inline SQL (line 5)
- **SQL query**: `select now();` (returns current timestamp)

---

### Script 5: db-healthcheck.ps1 (Query Healthcheck Table)

**File**: `src/server/scripts/db-healthcheck.ps1`
**Lines**: 1-5
```powershell
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
psql $conn -c "select * from healthcheck order by id desc limit 10;"
```
**Fact**: Queries `healthcheck` table (assumed to exist).
- **Env vars read**: Via `db-env.ps1`
- **Commands run**: `psql` with inline SQL (line 5)
- **SQL query**: Selects last 10 rows from `healthcheck` table
- **Assumption**: `healthcheck` table exists (not verified in migrations)

---

### Script 6: db-schema.ps1 (List All Tables)

**File**: `src/server/scripts/db-schema.ps1`
**Lines**: 1-5
```powershell
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
psql $conn -c "select table_name from information_schema.tables where table_schema = 'public' order by table_name;"
```
**Fact**: Lists all tables in `public` schema.
- **Env vars read**: Via `db-env.ps1`
- **Commands run**: `psql` with inline SQL (line 5)
- **SQL query**: Queries `information_schema.tables` for table names
- **Output**: List of user tables in database

---

### Script 7: db-dump-schema.ps1 (Export Schema to SQL File)

**File**: `src/server/scripts/db-dump-schema.ps1`
**Lines**: 1-15
```powershell
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
$outputDir = Join-Path $PSScriptRoot "..\..\docs\db"
$outputFile = Join-Path $outputDir "schema.sql"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}
$outputDir = (Resolve-Path $outputDir).Path
$outputFile = Join-Path $outputDir "schema.sql"

Write-Host "Dumping schema to $outputFile"
pg_dump $conn --schema-only --no-owner --no-privileges --file $outputFile
```
**Fact**: Exports database schema to SQL file.
- **Env vars read**: Via `db-env.ps1`
- **Commands run**: `pg_dump` (line 15)
- **Output file**: `docs/db/schema.sql` (relative to server root)
- **SQL files touched**: Creates `schema.sql` (does NOT read SQL files)

---

### Script 8: db-apply.ps1 (Apply SQL File to Database)

**File**: `src/server/scripts/db-apply.ps1`
**Lines**: 1-13
```powershell
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\db-env.ps1"

$conn = Get-DbConnString
$sqlFile = Join-Path $PSScriptRoot "..\..\docs\db\next.sql"

if (-not (Test-Path $sqlFile)) {
    throw "Missing SQL file: $sqlFile"
}
$sqlFile = (Resolve-Path $sqlFile).Path

Write-Host "Applying $sqlFile"
psql $conn -f $sqlFile
```
**Fact**: Applies `docs/db/next.sql` to database.
- **Env vars read**: Via `db-env.ps1`
- **Commands run**: `psql -f` with SQL file (line 13)
- **SQL files touched**: **READS** `docs/db/next.sql` (line 5)
- **Validation**: Throws error if `next.sql` missing (line 7-9)

**Gap**: Script expects `docs/db/next.sql` to exist. `docs/db/` directory does NOT exist in repo (verified by glob scan).

---

## SECTION 2: ENV FILES + GITIGNORE - FULL ANCHORS

### File 1: .env (Root Directory)

**File**: `.env`
**Lines**: 1-4
**Fact**:
- **OPENAI_API_KEY exists** (line 1) - value present but redacted
- **MIDTRANS_CLIENT_KEY exists** (line 3) - value present but redacted
- **MIDTRANS_SERVER_KEY exists** (line 4) - value present but redacted
- **Format**: `VAR_NAME = "value"` (spaces around equals sign)

**Security**: All values are `<REDACTED>`. Only variable names are shown.

---

### File 2: .env.local (Root Directory)

**File**: `.env.local`
**Lines**: 1-10
**Fact**:
- **VITE_OPENAI_API_KEY exists** (line 1) - value present but redacted
- **VITE_AI_MODE=real** (line 2)
- **VITE_LANG=id** (line 3)
- **VITE_API_BASE_URL=/api** (line 4)
- **VITE_ONBOARDING_ENABLED=true** (line 5)
- **VITE_GOOGLE_CLIENT_ID exists** (line 8) - value present but redacted
- **DATABASE_URL exists** (line 9) - value present but redacted (password redacted)
- **No MIDTRANS_* vars** in this file

---

### File 3: .env.production (Root Directory)

**File**: `.env.production`
**Lines**: 1-2
```
VITE_API_BASE_URL=/api
DATABASE_URL=postgres://arnvoid_app:YOUR_PASSWORD@127.0.0.1:5432/arnvoid
```
**Fact**:
- **DATABASE_URL exists** (line 2) - placeholder password `YOUR_PASSWORD`
- **VITE_API_BASE_URL=/api** (line 1)
- **No MIDTRANS_* vars** in production env file
- **Note**: File is template (contains placeholder password)

---

### File 4: .gitignore (Root Directory)

**File**: `.gitignore`
**Lines**: 72-78 (dotenv ignore rules)
```
# dotenv environment variables file
.env
.env.local
.env.production
.env.development.local
.env.test.local
.env.production.local
```
**Fact**: All env files are gitignored (lines 73-78).
- **.env** ignored (line 73) - contains MIDTRANS keys
- **.env.local** ignored (line 74)
- **.env.production** ignored (line 75) - contains DATABASE_URL template

**Security implication**: All env files (including MIDTRANS keys) are NOT committed to git (correct).

---

## SECTION 3: NODE-PG-MIGRATE CONFIGURATION TRUTH

### node-pg-migrate Help Output

**Command run**: `cd src/server && npm run migrate` (with no args)
**Output** (first 20 lines):
```
Usage: node-pg-migrate.js [up|down|create|redo] [migrationName] [options]

Options:
  -d, --database-url-var           Name of env variable where is set the
                                   databaseUrl[string] [default: "DATABASE_URL"]
  -m, --migrations-dir             The directory name or glob pattern containing
                                   your migration files (resolved from cwd()).
                                   When using glob pattern, "use-glob" must be
                                   used as well [string] [default: "migrations"]
      --use-glob                   Use glob to find migration files. This will
                                   use "migrations-dir" _and_ "ignore-pattern"
                                   to glob-search for migration files.
                                                      [boolean] [default: false]
  -t, --migrations-table           The table storing which migrations have been
                                   run        [string] [default: "pgmigrations"]
  -s, --schema                     The schema on which migration will be run
```

**Fact**:
- **DATABASE_URL env var** is default (line 7: `[default: "DATABASE_URL"]`)
- **Migrations dir** defaults to `migrations` (line 11: `[default: "migrations"]`)
- **Migrations table** defaults to `pgmigrations` (line 17: `[default: "pgmigrations"]`)
- **Working directory**: `src/server` (where `npm run` is executed)
- **Actual migrations path**: `src/server/migrations/` (relative to cwd)

**Configuration files searched**:
- `.pgmrc` - Not found (glob scan returned zero matches)
- `pgmigrate.config.js` - Not found
- `.pgmrc.js` / `.pgmrc.json` / `.pgmrc.yaml` - Not found

**Fact**: No node-pg-migrate config files exist. Uses **all defaults**.

---

### DATABASE_URL Verification

**Grep pattern**: `DATABASE_URL`
**Files searched**: `src/server/src/*`, `src/server/scripts/*`
**Result**: Zero matches in server code.

**Fact**: `DATABASE_URL` is **NOT referenced** in server code. Only used by:
1. `node-pg-migrate` (when running migrations)
2. Manual scripts that use `psql` (via `docs/db/next.sql` which doesn't exist)

**Gap**: `db.ts` uses individual env vars (`INSTANCE_CONNECTION_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) instead of `DATABASE_URL`.

---

## SECTION 4: EXTERNAL KNOWLEDGE - LABELED AS ASSUMPTIONS

The following claims in the original report were based on **external documentation** or **common behavior**, not code evidence. They are labeled here as **EXTERNAL ASSUMPTIONS**.

### Assumption 1: Pg Library Defaults

**Claim**: "pg defaults: max: 10 connections, idleTimeoutMillis: 10000ms"
**Source**: node-postgres documentation (https://node-postgres.com/apis/pool)
**Fact**: Code does NOT specify pool options (lines 23-28 in `db.ts`).
**Status**: EXTERNAL ASSUMPTION - May not reflect actual deployed configuration.

---

### Assumption 2: Express Body Parser Overflow Behavior

**Claim**: "Express default behavior when body exceeds limit: HTTP status 413"
**Source**: Express documentation (https://expressjs.com/en/4x/api.html#express.json)
**Fact**: Code does NOT test this behavior or have custom error handler.
**Status**: EXTERNAL ASSUMPTION - Actual behavior depends on Express version.

---

### Assumption 3: Midtrans Webhook Origin Header

**Claim**: "Midtrans webhooks typically send Origin header"
**Source**: Original report speculation.
**Fact**: No evidence found in code or Midtrans docs (not scanned).
**Status**: **UNVERIFIED ASSUMPTION** - Midtrans may or may not send Origin header.

**Verification needed**: Test actual Midtrans webhook request headers in sandbox.

---

### Assumption 4: Cloud SQL Connector Behavior

**Claim**: "Cloud SQL load balancer strips X-Forwarded-* headers"
**Source**: Google Cloud Run documentation (not verified in code).
**Fact**: Code trusts proxy level 1 (line 23 in `index.ts`).
**Status**: EXTERNAL ASSUMPTION - Relies on Cloud Run infrastructure behavior.

---

## SECTION 5: WEBHOOK+CORS RISK - VERIFIED

### Verification 1: Existing Webhook Handlers

**Grep pattern**: `webhook`
**Files searched**: Entire repo (recursive)
**Matches found**:
- `docs/report_2026_02_06_midtrans_core_api_forensic_exhaustive.md`
- `docs/report_2026_02_06_midtrans_http_stack_forensic.md`
- `docs/report_2026_02_05_midtrans_core_api_forensic.md`

**Fact**: **Zero webhook handlers exist in code**. Only mentioned in my own forensic reports.

---

### Verification 2: Origin Header Usage

**Grep pattern**: `origin|Origin|X-Forwarded`
**Files searched**: `src/server/src/index.ts`
**Matches found**:
- Line 46: `origin: (origin: string | undefined, cb: ...)` - CORS middleware callback parameter
- Line 47: `if (!origin)` - Checks if Origin header is missing
- Line 51: `if (corsAllowedOrigins.includes(origin))` - Validates origin
- Line 56: `console.warn(\`[cors] blocked origin: ${origin}\`)` - Logs blocked origin
- Line 23: `app.set("trust proxy", 1)` - Trusts X-Forwarded-* headers

**Fact**: Origin header is **ONLY used by CORS middleware**. No other code reads it.

---

### Verification 3: Webhook+CORS Interaction

**Code evidence**:
- Line 64: `app.use(cors(corsOptions))` - CORS middleware applies globally
- Line 65: `app.options(/.*/, cors(corsOptions))` - Preflight handler

**Fact**: Any route registered **after line 64** will be subject to CORS origin validation.

**Midtrans webhook scenario**:
1. **If Midtrans sends Origin header** (unverified):
   - And Origin is NOT in whitelist (likely)
   - Request will be rejected with error (line 57)
   - Webhook will NOT be processed
2. **If Midtrans does NOT send Origin header**:
   - Request will pass CORS check (line 47-49: `if (!origin) cb(null, true)`)
   - Webhook will be processed normally

**Risk level**: **UNKNOWN** - Depends on Midtrans implementation.
**Mitigation**: Register webhook route **before line 64** to bypass CORS entirely (regardless of Origin header behavior).

---

### Verification 4: SQL Files Existence

**Glob pattern**: `**/*.sql`
**Files searched**: Entire repo
**Result**: No matches found.

**Fact**: **Zero SQL files tracked in repo**.
- `docs/db/next.sql` (expected by `db-apply.ps1`) does NOT exist
- All schema files are generated ad-hoc via `pg_dump`

---

## SECTION 6: CORRECTIONS TO ORIGINAL REPORT

### Correction 1: Script Commands Run

**Original claim**: "db-apply.ps1 applies SQL files"
**Correction**: Only applies **ONE specific file**: `docs/db/next.sql` (line 5).
**Evidence**: `db-apply.ps1` lines 5-13.

---

### Correction 2: DATABASE_URL Usage

**Original claim**: "DATABASE_URL is used by migrations"
**Correction**: True, but **ONLY by migrations**. Server code (`db.ts`) does NOT use it.
**Evidence**: Grep for `DATABASE_URL` in `src/server/src/` returned zero matches.

---

### Correction 3: Migration Files

**Original claim**: "Exactly ONE migration file exists"
**Correction**: True. File is `src/server/migrations/1770332268745_init-tables.js`.
**Evidence**: Glob scan of `src/server/migrations/*.js` returned one file.
**Content**: Empty (lines 11, 18: `export const up = (pgm) => {};`)

---

### Correction 4: Healthcheck Table

**Original claim**: "Query healthcheck table (assumed to exist)"
**Correction**: Correctly labeled as assumption. `healthcheck` table existence NOT verified.
**Evidence**: `db-healthcheck.ps1` line 5 queries it, but no migration creates it.

---

### Correction 5: Midtrans Keys

**Original claim**: "Midtrans keys exist in .env file"
**Correction**: CONFIRMED with line ranges.
**Evidence**: `.env` lines 3-4 (MIDTRANS_CLIENT_KEY, MIDTRANS_SERVER_KEY).

---

### Correction 6: Pg Pool Defaults

**Original claim**: Listed specific default values (max: 10, idleTimeout: 10000ms)
**Correction**: Moved to **EXTERNAL ASSUMPTIONS** section. Code does NOT specify these.
**Evidence**: `db.ts` lines 23-28 show Pool created with `...clientOpts` (spread) but no explicit config.

---

## SECTION 7: NEW FINDINGS (NOT IN ORIGINAL REPORT)

### Finding 1: docs/db/ Directory Does Not Exist

**Glob pattern**: `docs/db/**`
**Result**: Directory not found.

**Fact**: `db-dump-schema.ps1` writes to `docs/db/schema.sql` (line 5), but directory does not exist in repo.
**Implication**: First run of `npm run db:dump:schema` will create directory.

---

### Finding 2: next.sql File Missing

**Script**: `db-apply.ps1` (line 5)
**Expected file**: `docs/db/next.sql`
**Actual existence**: File does NOT exist (verified by glob scan).

**Fact**: `npm run db:apply` will fail with error "Missing SQL file: .../docs/db/next.sql".
**Implication**: Manual SQL workflow is **non-functional** until `next.sql` is created.

---

### Finding 3: node-pg-migrate Migration Table

**Default table name**: `pgmigrations` (from help output line 17)
**Table existence**: NOT verified (no query in code checks for it)

**Fact**: Cannot determine if migrations have ever been run. `pgmigrations` table may or may not exist in database.

---

### Finding 4: Session ID Generation Method

**Code**: `src/server/src/index.ts` line 170
**Method**: `crypto.randomUUID()` (Node.js built-in)
**Format**: RFC 4122 UUID v4 (random)

**Fact**: App generates UUIDs, NOT database. No `gen_random_uuid()` in SQL queries.

---

### Finding 5: Transaction Isolation Level

**Grep pattern**: `BEGIN|COMMIT|ROLLBACK|SET TRANSACTION`
**Result**: Zero matches in `src/server/src/`

**Fact**: No transaction management code exists. All queries are auto-commit.

---

## END OF PATCH

**Status**: All missing anchors added. External assumptions labeled. Verified claims corrected.

**Recommendation**: Use this patch as supplement to original exhaustive report. For implementation, rely only on FACTS sections (with line anchors), not ASSUMPTIONS sections.

**Next verification step**: Test Midtrans sandbox webhook to verify Origin header behavior (address Assumption 3).
