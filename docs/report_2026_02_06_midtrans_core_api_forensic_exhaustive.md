# Midtrans Core API Forensic Report (Exhaustive Facts-First Scan)
**Date**: 2026-02-06
**Agent**: Claude Sonnet 4.5 (Maulana Core Mode)
**Mission**: Exhaustive forensic scan of backend infrastructure for Midtrans Core API integration
**Status**: SCAN COMPLETE. ZERO CODE CHANGES MADE.

---

## PART 1: OBSERVED FACTS (WITH ANCHORS)

All nontrivial claims include:
- **File path** (relative to repo root)
- **Line range(s)**
- **Literal code snippet** (≤15 lines) or summary

---

### A) BACKEND RUNTIME + SERVER COMPOSITION

#### A1. Node Version Requirements
**File**: `package.json` (root directory)
**Lines**: 6-8
```json
"engines": {
  "node": ">=20.0.0"
}
```
**Fact**: Root package.json requires Node ≥20.0.0. No server-specific package.json engine constraint found (server package.json line 2-4 has no engines field).

**Implication**: Node 18+ global `fetch` is available. Node 20+ is baseline.

#### A2. Express Version Declaration
**File**: `src/server/package.json`
**Lines**: 22-27
```json
"dependencies": {
  "@google-cloud/cloud-sql-connector": "^1.9.0",
  "cors": "^2.8.5",
  "express": "^5.2.1",
  "google-auth-library": "^10.5.0",
  "pg": "^8.18.0"
}
```
**Fact**: Express v5.2.1 is declared. No axios, no node-fetch, no helmet, no rate-limiting libraries.

#### A3. Server Entrypoints
**File**: `src/server/src/` (directory scan)
**Files found**:
- `index.ts` (302 lines) - main server
- `db.ts` (32 lines) - database connection pool
- `types/cors.d.ts` (type definitions only)

**Fact**: Exactly ONE server entrypoint exists: `src/server/src/index.ts`.

#### A4. Build/Dev Commands
**File**: `src/server/package.json`
**Lines**: 5-16
```json
"scripts": {
  "dev": "ts-node src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "db:proxy": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-proxy.ps1",
  "db:psql": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-psql.ps1",
  "db:ping": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-ping.ps1",
  "db:healthcheck": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-healthcheck.ps1",
  "db:schema": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-schema.ps1",
  "db:dump:schema": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-dump-schema.ps1",
  "db:apply": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-apply.ps1",
  "migrate": "node-pg-migrate"
}
```
**Fact**:
- Dev: `ts-node` (transpile on-the-fly)
- Build: `tsc` (TypeScript compiler)
- Start: `node dist/index.js` (compiled JS)
- Migrate: `node-pg-migrate` (no args provided, defaults to `up`)

#### A5. TypeScript Module System
**File**: `src/server/tsconfig.json`
**Lines**: 1-11
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```
**Fact**: Server compiles to **CommonJS (CJS)**, not ESM. Root package.json has `"type": "module"` but server does not override it locally. Server uses `ts-node` with CJS module output.

**Implication**: Imports use `require()` at runtime. No top-level await issues.

---

### B) MIDDLEWARE & REQUEST PARSING EXACT BEHAVIOR

#### B1. Middleware Registration Order
**File**: `src/server/src/index.ts`
**Lines**: 22-65 (sequential order)
```typescript
const app = express();                              // Line 22
app.set("trust proxy", 1);                          // Line 23
app.use(express.json({ limit: "1mb" }));           // Line 36 (FIRST middleware)
app.use(cors(corsOptions));                         // Line 64 (SECOND middleware)
app.options(/.*/, cors(corsOptions));               // Line 65 (THIRD middleware)
```
**Fact**: Middleware order is:
1. Body parser (1MB JSON limit)
2. CORS middleware (dynamic origin validation)
3. CORS preflight handler (global)

**No other middleware registered**. No error handler, no logging, no helmet, no rate limiting.

#### B2. Body Parser Configuration
**File**: `src/server/src/index.ts`
**Line**: 36
```typescript
app.use(express.json({ limit: "1mb" }));
```
**Fact**:
- JSON body limit: **1 megabyte**
- No `urlencoded()` parser
- No `raw()` body parser
- No `text()` body parser

**Implication for webhooks**: Midtrans sends JSON payloads. If webhook payload exceeds 1MB, Express will reject with HTTP 413 (Payload Too Large). Midtrans typical payloads are <10KB, so this is safe.

#### B3. Request Size Limit Behavior
**Fact**: Express default behavior when body exceeds limit:
- HTTP status 413 (Payload Too Large)
- Request body is NOT parsed (req.body remains undefined)
- Error goes to default Express error handler (not custom middleware, since none exists)

**Code evidence**: Line 36 shows `{ limit: "1mb" }` is the ONLY constraint. No custom error handler (verified by grep for `app.use.*err`, found zero matches in `src/server/src/`).

#### B4. Error-Handling Middleware
**Grep pattern**: `app\.use.*err|function.*err.*req.*res`
**File**: `src/server/src/index.ts`
**Result**: No matches found.
**Fact**: **Zero error-handling middleware exists**. Errors are handled inline in route handlers or propagate to Express default handler.

**Example inline error handling** (Lines 114-116):
```typescript
} catch (e) {
  res.status(500).json({ ok: false, error: String(e) });
}
```

---

### C) CORS AND CROSS-ORIGIN REALITY

#### C1. CORS Middleware Placement
**File**: `src/server/src/index.ts`
**Lines**: 64-65
```typescript
app.use(cors(corsOptions));            // Applied to ALL routes after this line
app.options(/.*/, cors(corsOptions));  // Preflight for ALL paths
```
**Fact**: CORS middleware applies globally. It will inspect **every request's Origin header**, including webhook requests from Midtrans.

**Critical detail**: CORS is a **browser-enforced** policy. Server-side calls (Midtrans webhook server) are not affected by CORS middleware. However, the server will still log CORS warnings for webhook requests if Origin header is present.

#### C2. CORS Configuration - Origin Validation
**File**: `src/server/src/index.ts`
**Lines**: 45-62
```typescript
const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      cb(null, true);  // Allow same-origin / mobile apps / no Origin header
      return;
    }
    if (corsAllowedOrigins.includes(origin)) {
      console.log(`[cors] allowed origin: ${origin}`);
      cb(null, true);
      return;
    }
    console.warn(`[cors] blocked origin: ${origin}`);
    cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
```
**Fact**:
- Requests **without Origin header** are allowed (line 47-49)
- Midtrans webhooks typically send **Origin header** (depends on Midtrans implementation)
- If Midtrans sends Origin header that is NOT in whitelist, request will be blocked (line 56-57)

**Implication**: Webhook endpoint MUST be registered **before** line 64 to bypass CORS checks entirely.

#### C3. Allowed Origins Source
**File**: `src/server/src/index.ts`
**Lines**: 29-44
```typescript
const DEFAULT_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const DEFAULT_ALLOWED_ORIGINS = ["https://beta.arnvoid.com"];
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const corsAllowedOrigins =
  allowedOrigins.length > 0
    ? allowedOrigins
    : [...DEFAULT_ALLOWED_ORIGINS, ...DEFAULT_DEV_ORIGINS];
if (isProd() && allowedOrigins.length === 0) {
  console.warn("[cors] ALLOWED_ORIGINS not set in prod; CORS will block real frontend");
}
```
**Fact**:
- If `ALLOWED_ORIGINS` env var is empty, defaults to `["https://beta.arnvoid.com", "http://localhost:5173", "http://127.0.0.1:5173"]`
- Prod detection warns if env var is missing (line 42-44)
- Midtrans webhook origin is NOT in default list (Midtrans servers call from `api.midtrans.com` or similar)

#### C4. Credentials Handling (Cookies)
**File**: `src/server/src/index.ts`
**Line**: 59
```typescript
credentials: true,
```
**Fact**: `Access-Control-Allow-Credentials: true` header is sent in CORS response.

**Cookie attributes** (Lines 210-216):
```typescript
res.cookie(COOKIE_NAME, sessionId, {
  httpOnly: true,
  sameSite,    // "lax" (line 28)
  secure,      // true if isProd() (line 94)
  path: "/",
  maxAge: SESSION_TTL_MS  // 7 days (line 27)
});
```

**Fact**:
- `sameSite: "lax"` in all environments (line 28, hardcoded)
- `secure: true` only in production (line 94: `const secure = isProd()`)
- `isProd()` returns true if `K_SERVICE` is set OR `NODE_ENV === "production"` (line 89)

**Implication for webhooks**: Midtrans webhook requests do NOT need cookies. Webhook endpoint should be registered before CORS middleware to avoid unnecessary cookie/CORS checks.

#### C5. Proxy Trust Configuration
**File**: `src/server/src/index.ts`
**Line**: 23
```typescript
app.set("trust proxy", 1);
```
**Fact**: Express trusts `X-Forwarded-*` headers from the first proxy (Cloud Run load balancer).

**Implications**:
- `req.protocol` correctly reports `https` behind Cloud Run
- `req.secure` correctly reports `true` in production
- Cookie `secure` flag (line 94) works correctly behind proxy
- Redirect URLs (if any) will use correct protocol/host

---

### D) AUTH/SESSION CHAIN + "WHO IS THE PAYER?" IDENTITY TRUTH

#### D1. Cookie Parsing Function
**File**: `src/server/src/index.ts`
**Lines**: 67-81
```typescript
function parseCookies(headerValue?: string) {
  const cookies: Record<string, string> = {};
  if (!headerValue) return cookies;

  const parts = headerValue.split(";");
  for (const part of parts) {
    const [rawName, ...rest] = part.split("=");
    const name = rawName.trim();
    if (!name) continue;
    const value = rest.join("=").trim();
    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}
```
**Fact**: Manual cookie parsing implementation.

**Edge cases handled**:
- Multiple `=` in cookie value: `rest.join("=")` preserves them (line 76)
- URL-encoded values: `decodeURIComponent(value)` decodes them (line 77)
- Whitespace: `trim()` on both name and value (lines 75, 76)
- Empty cookie header: returns empty object (lines 69)

**Known limitation**: Does NOT handle quoted values (RFC 6265 allows `name="value"`). Not an issue for this app (cookie values are simple UUIDs).

#### D2. Session ID Generation
**File**: `src/server/src/index.ts`
**Line**: 170
```typescript
const sessionId = crypto.randomUUID();
```
**Fact**: Session IDs are generated using Node.js built-in `crypto.randomUUID()` (RFC 4122 UUID v4).

**Database storage** (Lines 198-202):
```typescript
await pool.query(
  `insert into sessions (id, user_id, expires_at)
   values ($1, $2, $3)`,
  [sessionId, userRow.id, expiresAt]
);
```
**Fact**: App generates UUID, database stores it as-is. No DB-side UUID generation (no `gen_random_uuid()` in SQL).

#### D3. Session Validation Query
**File**: `src/server/src/index.ts`
**Lines**: 237-249
```typescript
const pool = await getPool();
const result = await pool.query(
  `select sessions.expires_at as expires_at,
          users.google_sub as google_sub,
          users.email as email,
          users.name as name,
          users.picture as picture
   from sessions
   join users on users.id = sessions.user_id
   where sessions.id = $1`,
  [sessionId]
);
```
**Fact**: Query joins `sessions` + `users` tables on `user_id`. Returns `google_sub` (NOT `users.id`).

**Critical gap**: `/me` endpoint does NOT return `users.id` (internal database primary key). It only returns `google_sub` (Google OAuth subject identifier).

**Evidence** (Lines 268-276):
```typescript
res.json({
  ok: true,
  user: {
    sub: row.google_sub,
    email: row.email ?? undefined,
    name: row.name ?? undefined,
    picture: row.picture ?? undefined
  }
});
```

**Implication for payments**: `user_id` (BIGINT PK) is needed for foreign key references in `transactions` table. Currently, `/me` does NOT expose it.

**Workaround**: Query users table by `google_sub` to get `users.id`:
```typescript
const result = await pool.query(
  `select id from users where google_sub = $1`,
  [user.google_sub]
);
const userId = result.rows[0].id;
```

#### D4. Session Expiry Handling
**File**: `src/server/src/index.ts`
**Lines**: 259-266
```typescript
const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
if (expiresAt && Date.now() > expiresAt.getTime()) {
  await pool.query("delete from sessions where id = $1", [sessionId]);
  clearSessionCookie(res);
  console.log("[auth] session expired -> cleared cookie");
  res.json({ ok: true, user: null });
  return;
}
```
**Fact**: Session expiry is checked **on every `/me` call**. Expired sessions are deleted from DB and cookie is cleared.

**TTL source** (Line 27):
```typescript
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7);
```
**Fact**: Default session TTL is 7 days. Configurable via `SESSION_TTL_MS` env var.

#### D5. Existing Auth Middleware
**Grep pattern**: `requireAuth|authenticate|middleware`
**File**: `src/server/src/index.ts`
**Result**: No auth middleware found.

**Fact**: Every route does auth **inline**. No reusable `requireAuth` middleware exists.

**Example inline auth** (Lines 230-235):
```typescript
app.get("/me", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  if (!sessionId) {
    res.json({ ok: true, user: null });
    return;
  }
  // ... rest of auth logic
});
```

**Implication for payments**: Need to create `requireAuth` middleware or inline auth in every payment route.

---

### E) DATABASE ACCESS + TRANSACTION CAPABILITY

#### E1. getPool Singleton Behavior
**File**: `src/server/src/db.ts`
**Lines**: 10-31
```typescript
let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) return pool;  // Singleton pattern

  const connector = new Connector();

  const clientOpts = await connector.getOptions({
    instanceConnectionName: INSTANCE_CONNECTION_NAME,
    ipType: "PUBLIC" as any, // we enabled Public IP on the instance, so this works
  });

  pool = new Pool({
    ...clientOpts,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  return pool;
}
```
**Fact**:
- **Singleton pattern**: Only ONE Pool instance is created (line 13)
- **Connector lifecycle**: New `Connector()` is created every time `getPool()` is called, but only used once (first call)
- **Pool options**: No custom configuration (max connections, idle timeout, etc.). Uses `pg` library defaults.

**Pg defaults** (from `pg` documentation):
- max: 10 connections
- idleTimeoutMillis: 10000ms (10 seconds)
- connectionTimeoutMillis: 0 (no timeout)

#### E2. Database Helper Utilities
**Grep pattern**: (query|select|insert|update|delete).*function|export.*function.*db
**Files**: `src/server/src/*.ts`
**Result**: Only `getPool()` in `db.ts`. No other DB helper utilities found.

**Fact**: All SQL queries use raw `pool.query()` calls directly in route handlers. No query builder, no ORM.

#### E3. All SQL Queries in Server
**Grep pattern**: pool\.query|SELECT|INSERT|UPDATE|DELETE
**File**: `src/server/src/index.ts`

| Line | Query Type | SQL Snippet | Tables | Columns |
|------|------------|-------------|--------|---------|
| 112 | SELECT | `SELECT 1` | N/A (healthcheck) | N/A |
| 183-190 | INSERT + UPSERT | `insert into users (...) on conflict (google_sub) do update ...` | users | google_sub, email, name, picture |
| 198-202 | INSERT | `insert into sessions (...) values (...)` | sessions | id, user_id, expires_at |
| 239-248 | SELECT + JOIN | `select sessions.expires_at, users.google_sub, users.email, users.name, users.picture from sessions join users on users.id = sessions.user_id where sessions.id = $1` | sessions, users | expires_at, google_sub, email, name, picture |
| 261 | DELETE | `delete from sessions where id = $1` | sessions | id |
| 288 | DELETE | `delete from sessions where id = $1` | sessions | id |

**Fact**: Total of **6 SQL queries** in entire server:
- 1 healthcheck (SELECT 1)
- 2 user operations (upsert user, insert session)
- 2 session operations (validate session, delete session)
- 1 logout (delete session)

**No tables** other than `users` and `sessions` are accessed.

#### E4. UUID Generation Method
**Grep pattern**: gen_random_uuid|uuid\(\)|crypto\.uuid
**File**: `src/server/src/index.ts`
**Line**: 170
```typescript
const sessionId = crypto.randomUUID();
```
**File**: `src/server/src/db.ts`
**Result**: No DB-side UUID generation found.

**Fact**: All UUIDs are generated in **application layer** using `crypto.randomUUID()`. Database does NOT use `gen_random_uuid()` or `uuid()` functions.

**Implication**: If payment tables need UUIDs, use `crypto.randomUUID()` in app code OR use `gen_random_uuid()` in migrations (if PostgreSQL 13+).

#### E5. Transaction Usage
**Grep pattern**: BEGIN|COMMIT|ROLLBACK|START TRANSACTION
**File**: `src/server/src/index.ts`
**Result**: No matches found.

**Fact**: **Zero database transactions** used in current code. All queries are auto-commit.

**Implication for payments**: Payment operations (credit balance + transaction insert) MUST use transactions to prevent partial updates. Need to add:
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... multiple queries
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

---

### F) MIGRATIONS REALITY (RESOLVE CONTRADICTIONS)

#### F1. node-pg-migrate Installation
**File**: `src/server/package.json`
**Line**: 16 (script)
```json
"migrate": "node-pg-migrate"
```

**File**: `package.json` (root)
**Line**: 36 (devDependency)
```json
"node-pg-migrate": "^8.0.4"
```
**Fact**: `node-pg-migrate` is installed as **dev dependency** in root package.json, referenced as npm script in server package.json.

**Invocation method**: Running `npm run migrate` in `src/server/` directory will execute `node-pg-migrate` (no args, defaults to `up` command).

#### F2. Migration Files
**File**: `src/server/migrations/1770332268745_init-tables.js`
**Lines**: 1-18
```javascript
export const shorthands = undefined;

export const up = (pgm) => {};

export const down = (pgm) => {};
```
**Fact**: Exactly **ONE migration file exists** and it is **empty** (no table creation, no indexes).

**Implication**: Current `users` and `sessions` tables were **NOT created via migrations**. They were created via manual SQL or Cloud Console (discouraged per `docs/db.md`).

#### F3. Migrations Applied Status
**Grep pattern**: migrations table|schema_migrations|node-pg-migrate.*table
**Files**: `src/server/src/*`, `docs/db.md`
**Result**: No evidence of migrations table in codebase.

**Fact**: **Cannot determine** if migrations have ever been applied. No `migrations` table query exists in code. No docs mention running `npm run migrate`.

**Likely scenario**: Tables were created manually. Migration system is installed but unused.

#### F4. SQL Files Applied by Scripts
**File**: `src/server/scripts/db-apply.ps1` (not read, but inferred from pattern)
**Grep pattern**: \.sql$|sql.*file
**Files**: `src/server/scripts/*`, `docs/db.md`
**Result**: No `.sql` files found in `src/server/` directory.

**Fact**: No SQL dump files tracked in repo. Any manual SQL was applied ad-hoc, not via tracked files.

**Exception**: `docs/db/md` may reference SQL files, but they are not in `src/server/scripts/`.

---

### G) OUTBOUND HTTP CLIENT / LOGGING / RETRIES BASELINE

#### G1. Global Fetch Usage
**Grep pattern**: fetch\(
**File**: `src/server/src/index.ts`
**Result**: No matches found.

**Fact**: **Global `fetch` is NOT used** in server code. Zero outbound HTTP calls exist.

**Transitive dependencies**: `package-lock.json` shows `node-fetch` is used by `google-auth-library` (line 1272), but NOT exposed to application code.

**Implication**: Midtrans HTTP client will be first outbound HTTP usage. Can safely use global `fetch` (Node 18+).

#### G2. Axios / node-fetch Dependencies
**File**: `src/server/package.json`
**Lines**: 22-28 (dependencies)
```json
"dependencies": {
  "@google-cloud/cloud-sql-connector": "^1.9.0",
  "cors": "^2.8.5",
  "express": "^5.2.1",
  "google-auth-library": "^10.5.0",
  "pg": "^8.18.0"
}
```
**Fact**: No `axios`, no `node-fetch`, no `got`, no `request` in dependencies.

**Implication**: Midtrans client should use **native `fetch`** (zero dependencies) or add axios as dependency.

#### G3. Logging Style
**Grep pattern**: console\.(log|warn|error|info)
**File**: `src/server/src/index.ts`

| Line | Call | Context |
|------|------|---------|
| 43 | console.warn | CORS warning in prod |
| 52 | console.log | CORS allowed origin |
| 56 | console.warn | CORS blocked origin |
| 132 | console.log | Auth audience check |
| 254 | console.log | Session missing -> cleared cookie |
| 263 | console.log | Session expired -> cleared cookie |
| 300 | console.log | Server listening |

**Fact**: Logging uses **plain `console.log/warn` only**. No structured logging, no request IDs, no log levels (debug/info/error), no third-party logging library (winston, pino).

**Log format**: `[tag] message` pattern (e.g., `[cors] blocked origin`, `[auth] session expired`).

#### G4. Timeouts
**Grep pattern**: timeout|setTimeout|setInterval
**File**: `src/server/src/index.ts`
**Result**: No matches found.

**Fact**: No global server timeout configured. No fetch timeout helpers exist (since no fetch usage).

**Express default**: No timeout on requests. Server will wait indefinitely for slow DB queries or Midtrans API calls.

**Implication for Midtrans client**: Need to implement fetch timeout explicitly:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  // ...
} catch (e) {
  clearTimeout(timeout);
  if (e.name === 'AbortError') {
    throw new Error('Midtrans API timeout');
  }
  throw e;
}
```

---

### H) DEPLOYMENT + ENV LOADING TRUTH

#### H1. dotenv Usage
**Grep pattern**: dotenv|config\(\)|require\(['"]dotenv['"]\)
**Files**: `src/server/src/*`, `src/server/package.json`
**Result**: No matches found.

**Fact**: **No `dotenv` library is used**. Environment variables are loaded directly from `process.env`.

**Implication**: Env vars must be set in shell session (PowerShell) before running server, or injected by Cloud Run at container start.

#### H2. All Environment Variables Referenced by Server
**Grep pattern**: process\.env\.
**Files**: `src/server/src/index.ts`, `src/server/src/db.ts`

**From `index.ts`**:

| Line | Variable | Default | Purpose |
|------|----------|---------|---------|
| 24 | `PORT` | 8080 | HTTP server port |
| 26 | `SESSION_COOKIE_NAME` | "arnvoid_session" | Session cookie name |
| 27 | `SESSION_TTL_MS` | 604800000 (7 days) | Session duration |
| 31 | `ALLOWED_ORIGINS` | "" (empty) | CORS allowed origins (comma-separated) |
| 89 | `K_SERVICE` | (no default) | Cloud Run service name (auto-set) |
| 89 | `NODE_ENV` | (no default) | Environment indicator |
| 126 | `GOOGLE_CLIENT_ID` | (no default) | Google OAuth client ID |

**From `db.ts`**:

| Line | Variable | Default | Purpose |
|------|----------|---------|---------|
| 5 | `INSTANCE_CONNECTION_NAME` | "" | Cloud SQL instance connection string |
| 6 | `DB_USER` | "" | Postgres username |
| 7 | `DB_PASSWORD` | "" | Postgres password |
| 8 | `DB_NAME` | "" | Postgres database name |

**Fact**: Total of **11 environment variables** referenced in server code. **No MIDTRANS_* variables** are referenced yet.

#### H3. Prod Detection Logic
**File**: `src/server/src/index.ts`
**Lines**: 88-90
```typescript
function isProd() {
  return Boolean(process.env.K_SERVICE) || process.env.NODE_ENV === "production";
}
```
**Fact**: Prod detection uses **OR logic**:
- Returns `true` if `K_SERVICE` is set (Cloud Run auto-sets this)
- OR returns `true` if `NODE_ENV === "production"`

**Usage** (Line 94):
```typescript
const secure = isProd();
```
**Fact**: Cookie `secure` flag is `true` in prod, `false` in dev.

**Also affects** (Lines 42-44):
```typescript
if (isProd() && allowedOrigins.length === 0) {
  console.warn("[cors] ALLOWED_ORIGINS not set in prod; CORS will block real frontend");
}
```

#### H4. Cloud Run Deploy Scripts/Docs
**Glob pattern**: **/cloudbuild*.yaml, **/deploy*.ps1, **/app*.yaml
**Files**: Root directory scan
**Result**: No Cloud Build config files, no deploy scripts found.

**Fact**: **No deployment scripts exist** in repo. Deployment is likely manual or via external tooling not tracked in git.

#### H5. Midtrans Keys Location
**File**: `.env` (root directory)
**Lines**: 3-4
**Fact**: MIDTRANS_CLIENT_KEY and MIDTRANS_SERVER_KEY exist (values redacted)
```
MIDTRANS_CLIENT_KEY = "<REDACTED>"
MIDTRANS_SERVER_KEY = "<REDACTED>"
```
**File**: `.env.production`
**Lines**: 1-2
```
VITE_API_BASE_URL=/api
DATABASE_URL=postgres://arnvoid_app:YOUR_PASSWORD@127.0.0.1:5432/arnvoid
```
**Fact**: Midtrans keys exist in root `.env` file. **Not referenced by server code yet**.

**Gap**: `.env.production` does NOT contain MIDTRANS keys. Root `.env` is ignored in production (gitignored via `.gitignore` line 73).

**Implication**: Midtrans env vars must be set in Cloud Run configuration manually.

---

### I) SECURITY SURFACES SPECIFIC TO PAYMENTS

#### I1. Rate Limiting
**Grep pattern**: rate.?limit|express-rate-limit|brute|throttl
**Files**: `src/server/package.json`, `src/server/src/*`
**Result**: No matches found.

**Fact**: **No rate limiting exists**. No middleware, no dependency.

**Implication for payments**:
- Payment creation endpoint is vulnerable to abuse (user can trigger unlimited Midtrans charges)
- Webhook endpoint has no rate limit (but Midtrans has their own retry logic, which is safe)
- Need to add rate limiting for `/api/payments/create`

#### I2. Request Signature Utilities
**Grep pattern**: crypto\.|createHash|Hmac|SHA|sign|verify
**File**: `src/server/src/index.ts`
**Results**:
- Line 1: `import crypto from "crypto";`
- Line 170: `const sessionId = crypto.randomUUID();`

**Fact**: Only crypto usage is `randomUUID()`. **No signature verification utilities** exist.

**Implication for webhooks**: Need to implement SHA512 signature verification from scratch:
```typescript
import crypto from "crypto";

function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  providedSignature: string,
  serverKey: string
): boolean {
  const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const expectedSignature = crypto.createHash('sha512').update(payload).digest('hex');
  return expectedSignature === providedSignature;
}
```

#### I3. Header Hardening (Helmet)
**Grep pattern**: helmet|Content-Security-Policy|X-Frame-Options
**Files**: `src/server/package.json`, `src/server/src/index.ts`
**Result**: No matches found.

**Fact**: **No Helmet.js or security headers middleware** exists.

**Default Express behavior**: No security headers are set. No `X-Frame-Options`, no `X-Content-Type-Options`, no `Content-Security-Policy`.

**Implication for payments**: Not critical for API-only backend (no HTML rendered), but webhook endpoint should validate `Content-Type: application/json`.

#### I4. Proxy Trust Configuration
**File**: `src/server/src/index.ts`
**Line**: 23
```typescript
app.set("trust proxy", 1);
```
**Fact**: Trust proxy is **enabled** (trust level 1 = first hop).

**Implications**:
- ✅ **Good**: `req.protocol` correctly reports HTTPS behind Cloud Run
- ✅ **Good**: Cookie `secure` flag works correctly
- ⚠️ **Risk**: If attacker can spoof `X-Forwarded-*` headers BEFORE Cloud Run, they can:
  - Fake `req.protocol` as `https`
  - Fake client IP (affects rate limiting if implemented)
  - Bypass security checks that rely on `req.ip`

**Mitigation**: Cloud Run load balancer strips `X-Forwarded-*` from external requests and re-adds them. Trust level 1 is safe for Cloud Run.

---

### J) FILE MAP APPENDIX (EXHAUSTIVE)

#### J1. All Relevant Files Scanned

**Server Core**:
| File | Lines | Purpose |
|------|-------|---------|
| `src/server/src/index.ts` | 302 | Express server, all routes, middleware |
| `src/server/src/db.ts` | 32 | Database connection pool (singleton) |
| `src/server/src/types/cors.d.ts` | - | TypeScript type definitions for CORS |

**Configuration**:
| File | Lines | Purpose |
|------|-------|---------|
| `src/server/package.json` | 37 | Server dependencies and scripts |
| `src/server/tsconfig.json` | 12 | TypeScript compiler configuration (CJS) |
| `package.json` | 41 | Root package.json (engines: >=20.0.0) |

**Migrations**:
| File | Lines | Purpose |
|------|-------|---------|
| `src/server/migrations/1770332268745_init-tables.js` | 19 | Empty migration (placeholder) |

**Database Scripts**:
| File | Purpose |
|------|---------|
| `src/server/scripts/db-env.ps1` | Env var helpers for local DB access |
| `src/server/scripts/db-proxy.ps1` | Start Cloud SQL Auth Proxy |
| `src/server/scripts/db-psql.ps1` | Open psql shell |
| `src/server/scripts/db-ping.ps1` | Ping database |
| `src/server/scripts/db-healthcheck.ps1` | Run healthcheck query |
| `src/server/scripts/db-schema.ps1` | List all tables |
| `src/server/scripts/db-dump-schema.ps1` | Dump schema to SQL file |
| `src/server/scripts/db-apply.ps1` | Apply SQL file to database |

**Environment Files**:
| File | Purpose |
|------|---------|
| `.env` | Local dev env vars (contains MIDTRANS keys) |
| `.env.production` | Production env vars template |
| `.env.local` | Local overrides |
| `.gitignore` | Git ignore rules (lines 72-78 ignore .env files) |

**Documentation Referenced**:
| File | Purpose |
|------|---------|
| `docs/db.md` | Database workflow guide |
| `docs/system.md` | System architecture (auth, sessions, CORS) |
| `docs/guide_auth_google_login.md` | Google login implementation guide |

#### J2. Grep Appendix: Patterns Searched + Top Hits

| Pattern | Top Hits | Context |
|---------|----------|---------|
| `fetch\|axios\|node-fetch` | 0 in src, 8 in package-lock.json | Only transitive deps (google-auth-library) |
| `cors` | 15 in index.ts | CORS middleware config |
| `cookie` | 25 in index.ts | Cookie parsing, session management |
| `SESSION` | 10 in index.ts, 2 in db.ts | Session constants, session queries |
| `MIDTRANS` | 2 in .env | Env vars (not referenced in code) |
| `migrate` | 2 in package.json, 1 in tsconfig | node-pg-migrate tool |
| `DATABASE_URL` | 1 in .env.production | Migration connection string |
| `Connector` | 3 in db.ts | Cloud SQL Connector usage |
| `Pool` | 4 in db.ts, 7 in index.ts | pg connection pool |
| `crypto\.` | 2 in index.ts | randomUUID usage only |
| `BEGIN\|COMMIT\|ROLLBACK` | 0 in src | No DB transactions |
| `helmet\|rate.?limit` | 0 in src | No security middleware |
| `dotenv` | 0 in src | No dotenv usage |

---

## PART 2: INTEGRATION IMPLICATIONS (DERIVED FROM FACTS)

These are **derived implications**, not direct facts. They represent "what this means for Midtrans integration" based on the facts above.

---

### IMPLICATION 1: Webhook Endpoint Registration Order

**Fact**: CORS middleware is at line 64, applies to ALL routes after it.
**Fact**: Midtrans webhooks may send Origin header (depends on Midtrans impl).
**Fact**: Webhook endpoint has no browser, so CORS is irrelevant but still logged.

**Implication**: Register webhook route **BEFORE line 64** to bypass CORS checks entirely.

**Recommended insertion point**: After line 107 (after `clearSessionCookie` function), before line 109 (first route).

```typescript
// Insert at line 109:
app.post("/api/payments/webhook", handleWebhook);  // No CORS, signature-based auth

// Existing middleware at line 64:
app.use(cors(corsOptions));
```

---

### IMPLICATION 2: User ID Extraction for Payment Foreign Keys

**Fact**: `/me` endpoint returns `google_sub` (OAuth subject), NOT `users.id` (database PK).
**Fact**: Payment tables need `user_id` BIGINT foreign key reference to `users.id`.

**Implication**: Need to query `users.id` by `google_sub` before creating payment transaction.

**Recommended pattern**:
```typescript
async function getUserIdFromGoogleSub(googleSub: string): Promise<bigint> {
  const pool = await getPool();
  const result = await pool.query(
    `select id from users where google_sub = $1`,
    [googleSub]
  );
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  return result.rows[0].id;
}
```

**Alternatively**: Modify `/me` to return `users.id` (breaking change for frontend).

---

### IMPLICATION 3: Database Transaction Requirement

**Fact**: Zero DB transactions used in current code.
**Fact**: Credit balance + transaction insert must be atomic (all-or-nothing).

**Implication**: Payment credit operations MUST use transactions. Need to implement transaction helper:

```typescript
async function runInTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

---

### IMPLICATION 4: Midtrans HTTP Client - Native Fetch

**Fact**: Node version requirement is ≥20.0.0.
**Fact**: Global `fetch` is available (Node 18+).
**Fact**: Zero outbound HTTP clients exist.
**Fact**: No axios dependency.

**Implication**: Use **native `fetch`** for Midtrans client. Zero dependencies. Matches 0-dependency philosophy.

**Required**: Implement timeout handling (no global timeout exists).

---

### IMPLICATION 5: Session Expiry and Webhook Race Condition

**Fact**: Session TTL is 7 days (default).
**Fact**: User can logout anytime (POST /auth/logout), which deletes session row.
**Fact**: Webhook arrives asynchronously (can be minutes/hours later).

**Implication**: Webhook CANNOT rely on session cookie. Must use **signature verification only**.

**Webhook security**: Verify SHA512 signature, NOT session. Midtrans provides signature key.

---

### IMPLICATION 6: Idempotency Requirement

**Fact**: No existing idempotency mechanisms (no idempotency keys, no deduplication).
**Fact**: Midtrans may send duplicate webhook notifications (retry logic).

**Implication**: Webhook handler MUST be idempotent. Use database constraints:
- `transactions.order_id UNIQUE` (order_id = midtrans order_id)
- `transactions.midtrans_transaction_id UNIQUE`
- `transactions.credited BOOLEAN` flag (prevent double-credit)

---

### IMPLICATION 7: Cookie Security in Production

**Fact**: `secure` flag is `true` if `isProd()` returns `true` (line 94).
**Fact**: `isProd()` checks `K_SERVICE` (Cloud Run auto-set) OR `NODE_ENV === "production"`.

**Implication**: Cookies work correctly in production (Cloud Run sets `K_SERVICE` automatically).
**Implication for local testing**: Set `NODE_ENV=production` to test secure cookies locally (will fail on localhost without HTTPS).

---

### IMPLICATION 8: Rate Limiting Gap for Payment Creation

**Fact**: No rate limiting exists.
**Fact**: Payment creation requires authenticated session.
**Fact**: Malicious user could trigger unlimited Midtrans charge requests.

**Implication**: Add rate limiting to `/api/payments/create`:
- Recommendation: 10 requests per minute per user
- Implementation: Express middleware with Redis (or in-memory for MVP)

---

### IMPLICATION 9: Migration System Readiness

**Fact**: `node-pg-migrate` v8.0.4 is installed.
**Fact**: One migration file exists but is empty.
**Fact**: Current tables (`users`, `sessions`) were NOT created via migrations.

**Implication**: Safe to create new migration for payment tables. Existing tables are outside migration system. This is acceptable (migrations only track NEW schema changes).

**Risk**: If someone adds migration to create `users` table later, it will fail (already exists). Solution: Mark initial schema as "baseline" and only migrate NEW tables.

---

### IMPLICATION 10: Logging and Monitoring Gaps

**Fact**: Logging uses plain `console.log/warn`.
**Fact**: No request IDs, no structured logging.
**Fact**: No error tracking service (Sentry, etc.).

**Implication for payments**:
- Difficult to trace webhook processing across logs
- No alerting on payment failures
- Recommendation: Add request ID middleware for payment routes

```typescript
import crypto from "crypto";

app.use("/api/payments", (req, res, next) => {
  req.id = crypto.randomUUID().slice(0, 8);  // Short ID
  console.log(`[payment:${req.id}] ${req.method} ${req.path}`);
  next();
});
```

---

## PART 3: RISKS (WITH WHY + WHICH LINE PROVES)

---

### RISK 1: Webhook Origin Blocked by CORS Middleware

**Severity**: MEDIUM
**Why**: If Midtrans sends Origin header and it's not in whitelist, request will be rejected before reaching webhook handler.
**Evidence**: Line 56-57 in `src/server/src/index.ts` - `cb(new Error(\`CORS blocked origin: ${origin}\`))`
**Mitigation**: Register webhook route BEFORE line 64 (CORS middleware).

---

### RISK 2: User ID Not Exposed by /me Endpoint

**Severity**: HIGH
**Why**: Payment tables need `users.id` (BIGINT PK) for foreign keys. `/me` only returns `google_sub` (VARCHAR). Frontend cannot get `users.id` without new endpoint or query.
**Evidence**: Lines 268-276 in `src/server/src/index.ts` - `/me` response does NOT include `users.id`
**Mitigation**: Add separate endpoint `/me/internal` that returns `users.id`, OR query by `google_sub` in payment routes.

---

### RISK 3: No Database Transactions for Credit Operations

**Severity**: CRITICAL
**Why**: If credit balance update fails after transaction insert, user gets free credits. Or if transaction insert fails after credit, user loses money.
**Evidence**: Zero `BEGIN/COMMIT/ROLLBACK` in codebase (grep search returned no matches)
**Mitigation**: Implement transaction wrapper for all credit operations.

---

### RISK 4: No Idempotency for Duplicate Webhooks

**Severity**: CRITICAL
**Why**: Midtrans may send duplicate webhook notifications (network retry). Without idempotency, user could be credited twice for one payment.
**Evidence**: No existing idempotency mechanisms (no unique constraints on webhook payloads, no deduplication logic)
**Mitigation**: Add `transactions.credited BOOLEAN` flag and check before crediting.

---

### RISK 5: No Rate Limiting on Payment Creation

**Severity**: MEDIUM
**Why**: Attacker with valid session could trigger unlimited Midtrans charge requests, causing API quota exhaustion or database spam.
**Evidence**: No rate limiting libraries or middleware found (grep for `rate.*limit` returned no matches)
**Mitigation**: Add rate limiting middleware (10 requests/min per user).

---

### RISK 6: No Request Timeout for Midtrans API Calls

**Severity**: MEDIUM
**Why**: If Midtrans API hangs, server request will wait indefinitely, causing database connection pool exhaustion.
**Evidence**: No `setTimeout` or timeout configuration found (grep for `timeout` returned no matches)
**Mitigation**: Implement AbortController with 30-second timeout on all fetch calls.

---

### RISK 7: Session Cookie Not Sent to Midtrans (Correct, but Fragile)

**Severity**: LOW
**Why**: Webhook does not use session cookie (relies on signature). If signature verification is buggy, attacker could fake payment notifications.
**Evidence**: Line 170 generates session ID, but webhook endpoint (not created yet) cannot access it
**Mitigation**: Ensure signature verification is robust. Always verify signature BEFORE processing webhook.

---

### RISK 8: No Request ID for Distributed Tracing

**Severity**: LOW
**Why**: If webhook processing spans multiple async steps, difficult to trace which log entries belong to which webhook.
**Evidence**: All logging is plain `console.log` without request correlation (grep for `console` showed no request IDs)
**Mitigation**: Add request ID generation for payment routes.

---

### RISK 9: Trust Proxy = 1 Allows Header Spoofing (if Misconfigured)

**Severity**: LOW
**Why**: If attacker can send request directly to container (bypassing Cloud Run LB), they can spoof `X-Forwarded-For` and bypass IP-based rate limiting.
**Evidence**: Line 23 - `app.set("trust proxy", 1)` trusts first hop
**Mitigation**: Ensure Cloud Run firewall only allows traffic from load balancer. Current setup is safe (Cloud Run default).

---

### RISK 10: Production Midtrans Keys Not in Version Control

**Severity**: LOW (actually GOOD, but operational risk)
**Why**: Midtrans keys exist in `.env` (gitignored) but NOT in `.env.production`. If `.env.production` is used for deployment, Midtrans keys will be missing.
**Evidence**: `.env` has keys (lines 3-4), `.env.production` does NOT (only has DATABASE_URL)
**Mitigation**: Manually set MIDTRANS_SERVER_KEY and MIDTRANS_ENVIRONMENT in Cloud Run config. Do NOT commit keys to git.

---

## END OF REPORT

**Status**: Exhaustive forensic scan complete. All facts documented with file paths, line numbers, and code snippets.
**Recommendation**: Proceed to implementation phase using this report as integration ground truth.

**Next Steps** (not part of scan):
1. Create `src/server/src/midtrans/` directory with HTTP client (native fetch)
2. Create database migration for payment tables
3. Add webhook handler (register BEFORE CORS middleware)
4. Add payment routes with auth middleware
5. Implement transaction wrapper for credit operations
6. Add rate limiting for payment creation
7. Set Midtrans env vars in Cloud Run
8. Test with sandbox credentials

**Estimated Implementation Time**: 10-15 hours (based on complexity revealed by this scan).
