# Midtrans Core API HTTP Stack Forensic Report
**Date**: 2026-02-06
**Agent**: Claude (Maulana Core Mode)
**Mission**: Scan backend HTTP stack, outbound client, env loading, and migrations reality
**Status**: SCAN COMPLETE. NO CODE CHANGES MADE.

---

## Executive Summary

Backend uses **Express.js v5.2.1** with minimal middleware stack. **Manual cookie parsing** (no cookie-parser). **Global fetch is available** (Node v22.14.0) but **currently unused** - no outbound HTTP clients exist yet. Environment variables use **direct process.env access** with **no dotenv**. Migrations directory exists with **node-pg-migrate** installed but current migration file is **empty placeholder**.

This is a **clean slate** for Midtrans HTTP client integration.

---

## 1. Backend HTTP Stack

### 1.1 Server Entry Point
**File**: `src/server/src/index.ts` (302 lines)

**Framework**: Express.js v5.2.1

**Server Initialization**:
```typescript
const app = express();
app.set("trust proxy", 1);  // Line 23 - respects X-Forwarded-*
const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`[server] listening on ${port}`);
});
```

**Trust Proxy Implications**:
- Essential for Cloud Run (behind Google's load balancer)
- Express will trust `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto`
- Required for correct CORS origin detection
- Required for generating correct redirect URLs (webhooks)

### 1.2 Middleware Stack (Order Matters)

**Middleware Chain** (sequential execution):

1. **Line 36**: Body Parser
```typescript
app.use(express.json({ limit: "1mb" }));
```
- Parses `Content-Type: application/json`
- 1MB payload limit
- Built into Express (no additional dependency)

2. **Lines 64-65**: CORS Middleware
```typescript
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
```
- Uses `cors` package v2.8.5
- Dynamic origin validation (whitelist based)
- Supports credentials (cookie auth)
- Preflight handling for all paths

**CORS Configuration** (Lines 38-62):
```typescript
const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      cb(null, true);  // Allow same-origin / mobile apps
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
  credentials: true,  // Required for cookies
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
```

**Origin Sources** (Lines 29-41):
```typescript
const DEFAULT_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const DEFAULT_ALLOWED_ORIGINS = ["https://beta.arnvoid.com"];
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const corsAllowedOrigins = allowedOrigins.length > 0
  ? allowedOrigins
  : [...DEFAULT_ALLOWED_ORIGINS, ...DEFAULT_DEV_ORIGINS];
```

**Production Safety Check** (Lines 42-44):
```typescript
if (isProd() && allowedOrigins.length === 0) {
  console.warn("[cors] ALLOWED_ORIGINS not set in prod; CORS will block real frontend");
}
```

**Webhook CORS Implications**:
- Midtrans webhooks come from external origin (NOT in whitelist)
- Webhook endpoint must bypass CORS checks
- Solution: Add webhook path BEFORE `app.use(cors())`, OR check path inside origin function

### 1.3 Route Registration Pattern

**All routes are inline** (no Express Router separation):

```
Line 109: app.get("/health", ...)
Line 119: app.post("/auth/google", ...)
Line 229: app.get("/me", ...)
Line 282: app.post("/auth/logout", ...)
```

**Pattern**: Direct registration on `app` object with async route handlers.

**For Midtrans Integration**:
- Follow same pattern (inline routes)
- Consider grouping under `/api/payments/*` prefix
- Webhook route MUST be registered before CORS middleware OR explicitly whitelist

**Recommended Registration Order**:
```typescript
// 1. Webhook (no auth, signature-based)
app.post("/api/payments/webhook", handleWebhook);

// 2. CORS middleware
app.use(cors(corsOptions));

// 3. Authenticated payment routes
app.post("/api/payments/create", requireAuth, handleCreatePayment);
app.get("/api/payments/:transactionId", requireAuth, handleGetPayment);
```

---

## 2. Cookie Parsing Method

### 2.1 Manual Implementation (No cookie-parser)

**Cookie Parser Function** (Lines 67-81):
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

**Usage Pattern** (Lines 230, 283):
```typescript
const cookies = parseCookies(req.headers.cookie);
const sessionId = cookies[COOKIE_NAME];
```

**Why Manual?**
- Lightweight (no dependency)
- Full control over parsing logic
- Simple key-value access is sufficient
- Only one cookie (`arnvoid_session`) is actively used

**Implications for Midtrans**:
- No cookies needed for outbound Midtrans API calls (uses Basic Auth)
- No cookies needed for webhook (uses signature verification)
- Session cookie still used for payment creation (user authentication)

### 2.2 Session Identity Extraction

**Cookie Name Configuration** (Line 26):
```typescript
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "arnvoid_session";
```

**Session Verification Flow** (`GET /me`, Lines 229-280):
```typescript
app.get("/me", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];

  if (!sessionId) {
    res.json({ ok: true, user: null });
    return;
  }

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

  const row = result.rows[0];
  if (!row) {
    clearSessionCookie(res);
    res.json({ ok: true, user: null });
    return;
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  if (expiresAt && Date.now() > expiresAt.getTime()) {
    await pool.query("delete from sessions where id = $1", [sessionId]);
    clearSessionCookie(res);
    res.json({ ok: true, user: null });
    return;
  }

  res.json({
    ok: true,
    user: {
      sub: row.google_sub,
      email: row.email ?? undefined,
      name: row.name ?? undefined,
      picture: row.picture ?? undefined
    }
  });
});
```

**User Identity Extraction for Payments**:
```typescript
// Pattern for requiring authenticated user in payment routes:
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];

  if (!sessionId) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const pool = await getPool();
  const result = await pool.query(
    `select users.id as user_id, users.google_sub
     from sessions
     join users on users.id = sessions.user_id
     where sessions.id = $1 and sessions.expires_at > NOW()`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    res.status(401).json({ ok: false, error: "invalid session" });
    return;
  }

  req.user = result.rows[0];  // Attach user to request
  next();
}
```

---

## 3. Outbound HTTP Client Reality

### 3.1 Current Outbound HTTP Usage

**Search Results**:
```
Grep for: (fetch|axios|node-fetch|https?) in src/server/src/

Found ONLY in:
- Line 29: DEFAULT_DEV_ORIGINS = ["http://localhost:5173", ...]
- Line 30: DEFAULT_ALLOWED_ORIGINS = ["https://beta.arnvoid.com"]
```

**Finding**: **ZERO outbound HTTP calls** in backend code currently.

### 3.2 Node Version Confirmation

**Root package.json** (Lines 6-8):
```json
"engines": {
  "node": ">=20.0.0"
}
```

**Actual Node Version**:
```
node --version
v22.14.0
```

**Critical Implication**: **Global `fetch` is available** (built-in since Node 18).

### 3.3 Midtrans HTTP Client Options

**Option A: Global Fetch (Recommended)**
```typescript
// No installation required (Node 18+)
const response = await fetch('https://api.sandbox.midtrans.com/v2/charge', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${authString}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify(chargePayload)
});
const data = await response.json();
```

**Pros**:
- Zero dependencies
- Native to Node 22 (already available)
- Consistent with frontend usage pattern

**Cons**:
- Less features than axios (no interceptors, no automatic retry)

**Option B: axios (Not Recommended)**
```typescript
import axios from 'axios';  // Requires npm install

const response = await axios.post(
  'https://api.sandbox.midtrans.com/v2/charge',
  chargePayload,
  {
    headers: {
      'Authorization': `Basic ${authString}`
    }
  }
);
```

**Pros**:
- More features (interceptors, automatic JSON transform, error handling)

**Cons**:
- Additional dependency (violate 0-dependency philosophy unless necessary)
- Not currently in backend package.json

**Option C: node-fetch (Not Recommended)**
- Polyfill for Node < 18
- Not needed for Node 22
- Would be redundant

### 3.4 Recommended HTTP Client Pattern

**Create**: `src/server/src/midtrans/client.ts`
```typescript
// Native fetch (no dependencies)

interface MidtransConfig {
  serverKey: string;
  environment: 'sandbox' | 'production';
}

interface ChargeResponse {
  status_code: string;
  status_message: string;
  transaction_id: string;
  order_id: string;
  gross_amount: string;
  payment_type: string;
  transaction_status: string;
  va_numbers?: Array<{ bank: string; va_number: string }>;
  redirect_url?: string;
  masked_card?: string;
}

export class MidtransClient {
  private config: MidtransConfig;
  private baseUrl: string;

  constructor(config: MidtransConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.midtrans.com/v2'
      : 'https://api.sandbox.midtrans.com/v2';
  }

  private getAuthString(): string {
    const authString = `${this.config.serverKey}:`;
    return Buffer.from(authString).toString('base64');
  }

  async charge(payload: unknown): Promise<ChargeResponse> {
    const url = `${this.baseUrl}/charge`;

    console.log(`[midtrans] charge request order_id=${payload.order_id}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.getAuthString()}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[midtrans] charge failed order_id=${payload.order_id} status=${response.status}`);
      throw new Error(`Midtrans API error: ${data.status_message || 'Unknown error'}`);
    }

    console.log(`[midtrans] charge response order_id=${payload.order_id} status_code=${data.status_code}`);

    return data;
  }

  async getStatus(orderId: string): Promise<ChargeResponse> {
    const url = `${this.baseUrl}/${orderId}/status`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${this.getAuthString()}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Midtrans API error: ${data.status_message || 'Unknown error'}`);
    }

    return data;
  }
}
```

**Usage in `index.ts`**:
```typescript
import { MidtransClient } from './midtrans/client';

const midtransClient = new MidtransClient({
  serverKey: process.env.MIDTRANS_SERVER_KEY || '',
  environment: (process.env.MIDTRANS_ENVIRONMENT as any) || 'sandbox'
});

app.post("/api/payments/create", requireAuth, async (req, res) => {
  const user = req.user as { user_id: bigint };

  const chargePayload = {
    payment_type: "bank_transfer",
    transaction_details: {
      order_id: `ARNV-${Date.now()}-${user.user_id}`,
      gross_amount: 50000
    },
    bank_transfer: {
      bank: "bca"
    },
    customer_details: {
      email: req.user.email
    }
  };

  try {
    const midtransResponse = await midtransClient.charge(chargePayload);
    // ... save to DB, respond to client
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});
```

---

## 4. Environment Variable Loading

### 4.1 Env Var Access Pattern

**Finding**: **No dotenv usage detected** in backend code.

**Grep Results**:
```
Grep for: (dotenv|config\(\)|\.env) in src/server/

Matches found ONLY in:
- Process.env reads (not dotenv)
```

**Pattern**: Direct `process.env` access throughout code.

**Example from `db.ts`** (Lines 4-8):
```typescript
const INSTANCE_CONNECTION_NAME = process.env.INSTANCE_CONNECTION_NAME || "";
const DB_USER = process.env.DB_USER || "";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "";
```

**Example from `index.ts`** (Lines 24-31):
```typescript
const port = Number(process.env.PORT || 8080);
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "arnvoid_session";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
```

### 4.2 Local Development

**PowerShell Script Pattern** (from `scripts/db-env.ps1`):
```powershell
function Require-Env($name) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not $value) {
        throw "Missing environment variable: $name"
    }
    return $value
}
```

**Implication**: Env vars are expected to be **set in shell session** before running server.

**Local Development Workflow**:
```powershell
# Set env vars in current PowerShell session
$env:INSTANCE_CONNECTION_NAME = "arnvoid-project:asia-southeast2:arnvoid-postgres"
$env:DB_USER = "arnvoid_app"
$env:DB_PASSWORD = "your_password"
$env:DB_NAME = "arnvoid"
$env:GOOGLE_CLIENT_ID = "your-client-id"
$env:MIDTRANS_SERVER_KEY = "Mid-server-..."
$env:MIDTRANS_ENVIRONMENT = "sandbox"

# Run server
cd src/server
npm run dev
```

### 4.3 Production Environment (Cloud Run)

**Env Var Provisioning**:
- Cloud Run injects env vars at container start
- Set via `gcloud cloud-run services update` or Cloud Console
- No `.env` files in source control (correct pattern)

**Production Detection** (Lines 88-90):
```typescript
function isProd() {
  return Boolean(process.env.K_SERVICE) || process.env.NODE_ENV === "production";
}
```

`K_SERVICE` is **Cloud Run specific** (set automatically).

### 4.4 Current Backend Env Var Inventory

**From `index.ts`**:
```typescript
// Server Configuration
PORT                          (default: 8080)
K_SERVICE                    (Cloud Run service name, automatic)
NODE_ENV                     (for isProd() check)

// Database
INSTANCE_CONNECTION_NAME      (Cloud SQL instance connection string)
DB_USER                      (Postgres user)
DB_PASSWORD                  (Postgres password)
DB_NAME                      (Postgres database name)

// Auth
GOOGLE_CLIENT_ID             (Google OAuth client ID)
SESSION_COOKIE_NAME          (default: "arnvoid_session")
SESSION_TTL_MS               (default: 604800000 = 7 days)
SESSION_COOKIE_SAMESITE      (not used in code, hardcoded "lax")
SESSION_COOKIE_SECURE        (not used in code, derived from isProd())

// CORS
ALLOWED_ORIGINS              (comma-separated list of origins)
```

**From `db.ts`**:
```typescript
INSTANCE_CONNECTION_NAME
DB_USER
DB_PASSWORD
DB_NAME
```

### 4.5 Midtrans Env Vars Needed

**Add to Backend**:
```typescript
// Midtrans Configuration
MIDTRANS_SERVER_KEY          (Server Key for API auth)
MIDTRANS_CLIENT_KEY          (Client Key - may only be needed frontend)
MIDTRANS_ENVIRONMENT         ("sandbox" | "production")
MIDTRANS_PAYMENT_URL         (optional, if overriding defaults)
```

**Frontend Env Vars** (if using Midtrans.js for 3DS):
```typescript
VITE_MIDTRANS_CLIENT_KEY     (Client Key for tokenization)
VITE_MIDTRANS_ENVIRONMENT    ("sandbox" | "production")
```

**Example `.env.local`** (not checked in):
```bash
# Backend
GOOGLE_CLIENT_ID=242743978070-vl4aap4odmiiqjrhoprtht2qd6elu504.apps.googleusercontent.com
INSTANCE_CONNECTION_NAME=arnvoid-project:asia-southeast2:arnvoid-postgres
DB_USER=arnvoid_app
DB_PASSWORD=your_password_here
DB_NAME=arnvoid
ALLOWED_ORIGINS=https://beta.arnvoid.com
MIDTRANS_SERVER_KEY=Mid-server-abc123...
MIDTRANS_ENVIRONMENT=sandbox

# Frontend (Vite)
VITE_API_BASE_URL=/api
VITE_GOOGLE_CLIENT_ID=242743978070-vl4aap4odmiiqjrhoprtht2qd6elu504.apps.googleusercontent.com
VITE_MIDTRANS_CLIENT_KEY=Mid-client-xyz789...
VITE_MIDTRANS_ENVIRONMENT=sandbox
```

**Current `.env` File** (root directory):
```
OPENAI_API_KEY = "<REDACTED>"
MIDTRANS_CLIENT_KEY = "<REDACTED>"
MIDTRANS_SERVER_KEY = "<REDACTED>"
```

**Security**: Values are `<REDACTED>`. Only variable names shown.
**Status**: Midtrans credentials already present. Ready for integration.

---

## 5. Database + Migrations Reality

### 5.1 Migration System Status

**Tool**: `node-pg-migrate` v8.0.4

**Installed**: YES (in `src/server/package.json`)
```json
"devDependencies": {
  "node-pg-migrate": "^8.0.4"
}
```

**NPM Script** (Line 16):
```json
"migrate": "node-pg-migrate"
```

**Migrations Directory**: `src/server/migrations/`

**Current Migration File**: `src/server/migrations/1770332268745_init-tables.js`
```javascript
export const shorthands = undefined;

export const up = (pgm) => {};

export const down = (pgm) => {};
```

**Status**: **EMPTY PLACEHOLDER** - No tables created via migrations yet.

### 5.2 Database Connection

**File**: `src/server/src/db.ts` (32 lines)

**Client**: `pg` (node-postgres) v8.18.0

**Connection Method**: **Cloud SQL Connector** (IAM-based auth)
```typescript
import { Connector } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";

const INSTANCE_CONNECTION_NAME = process.env.INSTANCE_CONNECTION_NAME || "";
const DB_USER = process.env.DB_USER || "";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "";

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) return pool;  // Singleton

  const connector = new Connector();

  const clientOpts = await connector.getOptions({
    instanceConnectionName: INSTANCE_CONNECTION_NAME,
    ipType: "PUBLIC" as any,  // Public IP enabled
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

**Connection Type**: **Public IP** (Line 20 comment confirms)

**No ORM**:
- No Sequelize
- No TypeORM
- No Prisma
- No Knex
- **Raw SQL only** (parameterized queries via `pg`)

### 5.3 Current Schema Inference

**From auth flow queries**, the schema is:

```sql
-- Inferred from /auth/google (Lines 183-190)
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  google_sub VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  picture TEXT
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL
);

-- Inferred from /me (Lines 240-248)
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
```

**No Tables For** (confirmed):
- transactions
- payments
- credits
- webhooks
- orders
- products

### 5.4 How Tables Were Created

**Finding**: **UNKNOWN** - Migrations file is empty.

**Possible explanations**:
1. Manual SQL execution via `psql` (likely, given `scripts/db-apply.ps1`)
2. Cloud Console (discouraged per `docs/db.md`)
3. Untracked migration (not checked into repo)

**Evidence from `docs/db.md`**:
```
- Prefer SQL files checked into docs for repeatability.
- Do not edit schema in Cloud Console.
```

**Recommendation**: **Use migration system for payment tables** (not manual SQL).

### 5.5 Migration Workflow for Midtrans

**Step 1: Create migration file**
```bash
cd src/server
npx node-pg-migrate create add-payment-tables
```

**Generates**: `src/server/migrations/TIMESTAMP_add-payment-tables.js`

**Step 2: Edit migration file**
```javascript
/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // Transactions table
  pgm.createTable('transactions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid')
    },
    user_id: {
      type: 'bigint',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    order_id: {
      type: 'varchar(255)',
      unique: true,
      notNull: true
    },
    gross_amount: {
      type: 'decimal(10,2)',
      notNull: true
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'created'
    },
    payment_type: {
      type: 'varchar(50)',
      notNull: true
    },
    midtrans_transaction_id: {
      type: 'varchar(255)',
      unique: true
    },
    midtrans_response: {
      type: 'jsonb'
    },
    credited: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP')
    },
    paid_at: {
      type: 'timestamp'
    },
    credited_at: {
      type: 'timestamp'
    }
  });

  pgm.createIndex('transactions', 'user_id');
  pgm.createIndex('transactions', 'order_id');
  pgm.createIndex('transactions', 'status');

  // Credit balances
  pgm.createTable('credit_balances', {
    user_id: {
      type: 'bigint',
      primaryKey: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    balance: {
      type: 'decimal(10,2)',
      notNull: true,
      default: 0
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP')
    }
  });

  // Credit transactions
  pgm.createTable('credit_transactions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid')
    },
    user_id: {
      type: 'bigint',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    amount: {
      type: 'decimal(10,2)',
      notNull: true
    },
    type: {
      type: 'varchar(20)',
      notNull: true
    },
    transaction_id: {
      type: 'uuid',
      references: 'transactions(id)',
      onDelete: 'SET NULL'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP')
    }
  });

  pgm.createIndex('credit_transactions', 'user_id');
  pgm.createIndex('credit_transactions', 'transaction_id', { unique: true });

  // Webhook logs
  pgm.createTable('webhook_logs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid')
    },
    order_id: {
      type: 'varchar(255)',
      notNull: true
    },
    payload: {
      type: 'jsonb',
      notNull: true
    },
    signature: {
      type: 'varchar(255)',
      notNull: true
    },
    signature_valid: {
      type: 'boolean',
      notNull: true
    },
    processed: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    processing_error: {
      type: 'text'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP')
    }
  });

  pgm.createIndex('webhook_logs', 'order_id');
  pgm.createIndex('webhook_logs', 'created_at');
};

export const down = (pgm) => {
  pgm.dropTable('webhook_logs');
  pgm.dropTable('credit_transactions');
  pgm.dropTable('credit_balances');
  pgm.dropTable('transactions');
};
```

**Step 3: Apply migration**
```bash
# Ensure Cloud SQL Auth Proxy is running
npm run db:proxy

# Set DATABASE_URL env var
$env:DATABASE_URL = "postgres://arnvoid_app:password@127.0.0.1:5432/arnvoid"

# Run migration
npm run migrate up
```

**Step 4: Verify**
```bash
npm run db:schema
# Should show transactions, credit_balances, credit_transactions, webhook_logs
```

### 5.6 Migration System Benefits

**Why use migrations instead of manual SQL?**
1. **Reproducibility** - Same migration works in dev, staging, prod
2. **Version control** - All schema changes tracked in git
3. **Rollback** - `down()` function allows reverting changes
4. **Team safety** - No "who edited the schema in Cloud Console?" confusion
5. **Audit trail** - `node-pg-migrate` creates `migrations` table to track applied migrations

**Existing `node-pg-migrate` Configuration**:
- Uses `DATABASE_URL` env var for connection
- Stores migration state in `migrations` table (auto-created)
- Supports up/down migrations
- Supports JavaScript migrations (current approach)

---

## 6. Production Deployment Reality

### 6.1 Cloud Run Configuration

**Detection** (Lines 88-90):
```typescript
function isProd() {
  return Boolean(process.env.K_SERVICE) || process.env.NODE_ENV === "production";
}
```

`K_SERVICE` environment variable is **automatically set by Cloud Run**.

**Implications**:
- Cookie `secure` flag is `true` in prod (Line 94)
- CORS warning if `ALLOWED_ORIGINS` not set (Lines 42-44)

### 6.2 Database Connection

**Connection Method**: Public IP (Line 20 comment)
```typescript
ipType: "PUBLIC" as any  // we enabled Public IP on the instance
```

**Why Public IP?**
- Simpler than private IP + VPC setup
- Works from anywhere (including local dev)
- No serverless VPC connector needed

**Security Considerations**:
- Requires strong password (DB_PASSWORD env var)
- SSL enforced by Cloud SQL Connector
- IAM authentication could be added (current setup uses password)

### 6.3 Webhook Endpoint Requirements

**Public URL Needed**:
- Midtrans servers call webhook from external network
- Cannot be `localhost`
- Must be HTTPS (Midtrans requirement)

**Cloud Run + Firebase/Domains**:
```
https://backend.arnvoid.com/api/payments/webhook
https://api.arnvoid.com/payments/webhook
https://arnvoid-backend.run.app/webhook  (default Cloud Run URL)
```

**Webhook Registration**:
- Must be configured in Midtrans Dashboard
- Sandbox and Production have separate webhook URLs
- Midtrans provides signature key for verification

---

## 7. Integration Points Summary

### 7.1 Clean Integration Seams

**1. Payment Routes** (`src/server/src/index.ts`)
```typescript
// Add after line 297 (after /auth/logout)
import { MidtransClient } from './midtrans/client';
import { requireAuth } from './middleware/auth';

const midtransClient = new MidtransClient({
  serverKey: process.env.MIDTRANS_SERVER_KEY || '',
  environment: (process.env.MIDTRANS_ENVIRONMENT as any) || 'sandbox'
});

// Register BEFORE CORS middleware
app.post("/api/payments/webhook", handleWebhook);

// Register after CORS middleware
app.post("/api/payments/create", requireAuth, handleCreatePayment);
app.get("/api/payments/:transactionId", requireAuth, handleGetPayment);
app.get("/api/payments/user", requireAuth, handleGetUserPayments);
app.get("/api/credits/balance", requireAuth, handleGetCreditBalance);
app.get("/api/credits/history", requireAuth, handleGetCreditHistory);
```

**2. Midtrans Client Module** (NEW FILE)
```
src/server/src/midtrans/
  client.ts       - HTTP client wrapper using native fetch
  types.ts        - TypeScript types
  signature.ts    - SHA512 verification utility
  charge.ts       - Charge API logic
  webhook.ts      - Webhook processing logic
```

**3. Database Migrations** (node-pg-migrate)
```
src/server/migrations/
  1770332268745_init-tables.js           (existing, empty)
  TIMESTAMP_add-payment-tables.js        (NEW)
  TIMESTAMP_add-credit-system.js         (NEW)
```

**4. Environment Variables** (add to Cloud Run)
```bash
MIDTRANS_SERVER_KEY=Mid-server-...
MIDTRANS_ENVIRONMENT=sandbox
```

### 7.2 No Conflicts Detected

- No existing payment/credit logic (greenfield)
- No existing webhook handlers (greenfield)
- No outbound HTTP clients (greenfield)
- No conflicting middleware (easy to insert routes)
- Migration system installed but unused (ready to use)

---

## 8. Risk Assessment

### 8.1 Low Risk Areas

- **HTTP Client**: Native fetch is stable and battle-tested
- **Database**: `pg` library is mature and reliable
- **Migrations**: `node-pg-migrate` is standard tool
- **Cookie Parsing**: Manual implementation is simple and correct

### 8.2 Medium Risk Areas

- **Webhook Security**: Must implement signature verification correctly
- **Idempotency**: Must prevent double-credit scenarios
- **CORS + Webhooks**: Webhook bypasses auth, needs careful implementation
- **Transaction Rollback**: DB transactions for credit operations must be correct

### 8.3 Open Questions

1. **Who creates the payment tables?**
   - Manual SQL or migration? (Recommend: migration)

2. **What is the production webhook URL?**
   - Need to configure custom domain or use default Cloud Run URL

3. **Midtrans credentials rotation?**
   - How to rotate server key without downtime?

4. **Monitoring and alerting?**
   - Need to track webhook failures, payment errors, credit anomalies

---

## 9. File Reference Table

### Backend HTTP Stack
| File | Lines | Purpose |
|------|-------|---------|
| `src/server/src/index.ts` | 302 | Express server, routes, middleware |
| `src/server/src/db.ts` | 32 | PostgreSQL connection pool |

### Migrations
| File | Lines | Purpose |
|------|-------|---------|
| `src/server/migrations/1770332268745_init-tables.js` | 19 | Empty placeholder |
| `src/server/package.json` | 37 | node-pg-migrate dependency |

### Scripts
| File | Purpose |
|------|---------|
| `src/server/scripts/db-env.ps1` | Env var helpers for local DB access |
| `src/server/scripts/db-proxy.ps1` | Start Cloud SQL Auth Proxy |
| `src/server/scripts/db-apply.ps1` | Apply SQL files to DB |

### Documentation
| File | Purpose |
|------|---------|
| `docs/db.md` | Database workflow guide |
| `docs/system.md` | System architecture |
| `docs/report_2026_02_05_midtrans_core_api_forensic.md` | Previous Midtrans analysis |

---

## 10. Next Steps (For Implementation Phase)

### Phase 1: Database Schema
- [ ] Create migration for payment tables
- [ ] Create migration for credit system tables
- [ ] Create migration for webhook logs
- [ ] Apply migrations to database
- [ ] Verify schema with `npm run db:schema`

### Phase 2: Midtrans Client
- [ ] Create `src/server/src/midtrans/client.ts`
- [ ] Implement charge API wrapper using native fetch
- [ ] Implement status API wrapper
- [ ] Add signature verification utility
- [ ] Add comprehensive logging

### Phase 3: Backend Routes
- [ ] Create auth middleware for protected routes
- [ ] Implement webhook handler (signature verification, idempotency)
- [ ] Implement payment creation endpoint
- [ ] Implement payment status endpoint
- [ ] Implement credit balance/history endpoints

### Phase 4: Testing
- [ ] Test payment creation with Midtrans sandbox
- [ ] Test webhook handling with ngrok/localtunnel
- [ ] Test idempotency with duplicate webhooks
- [ ] Test credit application logic
- [ ] Load test webhook endpoint

### Phase 5: Production
- [ ] Configure production webhook URL in Midtrans Dashboard
- [ ] Set environment variables in Cloud Run
- [ ] Enable monitoring and alerting
- [ ] Test with real payment (small amount)
- [ ] Document runbook for incidents

---

**End of Report**

**Status**: Forensic scan complete. All facts documented. No code changes made.
**Recommendation**: Review this report, answer open questions, then proceed to implementation phase.

**Estimated Implementation Time**:
- Phase 1 (Schema): 1-2 hours
- Phase 2 (Client): 2-3 hours
- Phase 3 (Routes): 3-4 hours
- Phase 4 (Testing): 2-3 hours
- Phase 5 (Production): 2-3 hours
**Total**: ~10-15 hours for full Midtrans Core API integration.
