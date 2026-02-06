# Forensic Report: Midtrans Core API Integration Scan
**Date**: 2026-02-05
**Purpose**: Scan Arnvoid repo for tight Midtrans Core API wiring (charge + webhook + status)
**Status**: PRE-IMPLEMENTATION ANALYSIS (NO CODE CHANGES)

---

## 1. Scope

This report documents a forensic scan of the Arnvoid codebase to prepare for Midtrans Core API integration. The goal is to identify existing patterns, integration points, and architectural decisions BEFORE implementing payment functionality.

**Target Integration:**
- Midtrans Core API (not SNAP)
- Bank Transfer (Virtual Account)
- Credit Card with 3DS
- HTTP notification webhook handler
- Transaction status polling

**Hard Constraints:**
- Do NOT implement any code changes
- Do NOT use browser testing tools
- ASCII only in logs/docs
- Follow existing patterns

---

## 2. Current Codebase Findings

### 2.1 Backend Entrypoint + Route Registration

**File**: `src/server/src/index.ts` (304 lines)

**Framework**: Express.js v5.2.1

**Server Creation**:
```typescript
const app = express();
const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`[server] listening on ${port}`);
});
```

**Middleware Stack** (order matters):
1. Line 36: `express.json({ limit: "1mb" })` - JSON body parser
2. Line 60: `app.use(cors(corsOptions))` - CORS middleware
3. Line 61: `app.options(/.*/, cors(corsOptions))` - Preflight handler

**Route Registration** (all inline, no router separation):
```
GET  /health          - Lines 113-121  (health check + DB ping)
POST /auth/google     - Lines 123-229  (Google OAuth login)
GET  /me              - Lines 231-282  (session validation)
POST /auth/logout     - Lines 284-299  (logout)
```

**Pattern**: No Express Router separation. All routes defined directly on `app` object.

**Integration Implication**: Midtrans routes should be added inline following the same pattern. Consider grouping under `/api/payments/*` prefix for clarity.

---

### 2.2 Auth/Session Architecture

**Session Cookie Configuration**:

Lines 24-29 define session behavior:
```typescript
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "arnvoid_session";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7); // 7 days
const COOKIE_SAMESITE = (process.env.SESSION_COOKIE_SAMESITE || "lax").toLowerCase();
const COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE
  ? process.env.SESSION_COOKIE_SECURE === "true"
  : null;
```

**Cookie Parsing** (Lines 63-77):
- Function: `parseCookies(headerValue?: string)`
- Manually splits `Cookie` header on `;`
- Decodes values via `decodeURIComponent()`
- Returns `Record<string, string>`

**Session Verification Flow** (Lines 231-282, `/me` endpoint):
```
1. Parse cookies from req.headers.cookie
2. Extract arnvoid_session cookie
3. Query DB: JOIN sessions + users WHERE sessions.id = $1
4. Check expiry (sessions.expires_at > Date.now())
5. If invalid: clear cookie + return user: null
6. If valid: return user object (google_sub, email, name, picture)
```

**User Identity Extraction**:
```typescript
// DB query returns:
{
  google_sub: string;   // Google OAuth subject (unique ID)
  email: string | null;
  name: string | null;
  picture: string | null;
}

// Frontend receives (via /me):
{
  id: number;           // users.id (internal DB PK)
  email?: string;
  name?: string;
  picture?: string;
}
```

**Type Mismatch Alert**:
- Backend returns `google_sub` as the primary user identifier
- Frontend `src/auth/useAuth.ts` expects `id: number`
- This is the `users.id` (BIGSERIAL), not the `google_sub`
- For payments, we should use `users.id` (internal PK) for foreign keys

**Cookie Clearing** (Lines 103-111):
```typescript
function clearSessionCookie(res: express.Response) {
  const { sameSite, secure } = resolveCookieOptions();
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/"
  });
}
```

**Integration Implication**:
- Payment creation requires authenticated session
- Extract `user_id` from session for transaction ownership
- Use `users.id` (BIGSERIAL) as foreign key, NOT `google_sub`

---

### 2.3 Database Layer

**File**: `src/server/src/db.ts` (32 lines)

**Client**: `pg` (node-postgres) v8.18.0
- NO ORM (no Sequelize, TypeORM, Prisma)
- NO migration system (no db-migrate, Knex, Flyway)
- NO query builder (raw SQL only)

**Connection Pattern**:
```typescript
import { Connector } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";

const INSTANCE_CONNECTION_NAME = process.env.INSTANCE_CONNECTION_NAME || "";
const DB_USER = process.env.DB_USER || "";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "";

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) return pool;  // Singleton pattern

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

**Connection Type**: Public IP (line 20 comment: "we enabled Public IP on the instance")

**Query Pattern** (from `index.ts`):
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
const row = result.rows[0];
```

**Schema Inference** (from queries):
```sql
-- Inferred from auth flow:
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
```

**No Existing Tables For**:
- orders
- transactions
- payments
- credits
- webhooks

**Integration Implication**:
- Must create new tables for transactions/payments
- Must add migration system OR use manual SQL files
- Follow existing naming convention: snake_case, lowercase
- Use PostgreSQL features: UUID, JSONB, TIMESTAMP

---

### 2.4 Existing Billing/Pricing/Credits Logic

**Finding**: NONE FOUND

**Scanned Files**:
- `src/store/documentStore.tsx` - Document state management only
- `src/fullchat/FullChatbar.tsx` - Chat UI only
- `src/components/*` - UI components only
- `src/ai/*` - AI client wrapper only
- `src/physics/*` - Physics engine only
- `src/graph/*` - Graph topology only

**No Evidence Of**:
- Price configuration (hardcoded or env-based)
- Credit balance tracking
- Usage meters
- Subscription tiers
- Analysis duration limits
- Quota enforcement

**Integration Implication**:
- Greenfield payment integration
- Need to define what we're selling (credits? subscription? one-time?)
- Recommend: Start with simple "buy credits" model
- Price points should be configured via env vars or database

---

### 2.5 Existing Webhook Pattern

**Finding**: NONE FOUND

**Scanned Files**:
- `src/server/src/index.ts` - No webhook endpoints
- All existing routes are request/response (no async callbacks)

**No Evidence Of**:
- POST endpoints receiving external notifications
- Signature verification logic
- Idempotency handling
- Retry mechanisms

**Integration Implication**:
- First webhook endpoint in the system
- Must establish pattern for:
  - Signature verification (SHA512)
  - Idempotency (duplicate notifications)
  - Logging (all webhook deliveries)
  - Error handling (return 200 even if processing fails)

---

### 2.6 Environment Variable Conventions

**Frontend (Vite)**: `VITE_*` prefix (accessed via `import.meta.env`)

**File**: `.env.local`
```
VITE_OPENAI_API_KEY="sk-proj-..."
VITE_AI_MODE=real
VITE_LANG=id
VITE_API_BASE_URL=http://localhost:8080
VITE_GOOGLE_CLIENT_ID=242743978070-vl4aap4odmiiqjrhoprtht2qd6elu504.apps.googleusercontent.com
```

**Backend**: Direct `process.env` access (no prefix requirement)

**From `src/server/src/index.ts`**:
```typescript
// Server config
PORT                          (default: 8080)

// Database
INSTANCE_CONNECTION_NAME
DB_USER
DB_PASSWORD
DB_NAME

// Auth
GOOGLE_CLIENT_ID
SESSION_COOKIE_NAME          (default: "arnvoid_session")
SESSION_TTL_MS               (default: 604800000 = 7 days)
SESSION_COOKIE_SAMESITE      (default: "lax")
SESSION_COOKIE_SECURE        (default: prod=true, dev=false)

// CORS
ALLOWED_ORIGINS              (comma-separated)
```

**From `src/server/src/db.ts`**:
```typescript
INSTANCE_CONNECTION_NAME
DB_USER
DB_PASSWORD
DB_NAME
```

**From `.env` (root directory - appears to be shared)**:
```
OPENAI_API_KEY = "sk-proj-..."
MIDTRANS_CLIENT_KEY = "..."
MIDTRANS_SERVER_KEY = "..."
```

**Note**: `.env` is in root directory (NOT `src/server/.env`)
- This suggests both frontend and backend might read from same file
- But `OPENAI_API_KEY` has no `VITE_` prefix, which is unusual for Vite
- `MIDTRANS_*` vars also have no prefix

**Frontend API Base URL Pattern**:

File: `src/api.ts`
```typescript
const BASE = import.meta.env.VITE_API_BASE_URL;

export async function apiGet(path: string): Promise<ApiGetResult> {
  if (!BASE || !BASE.trim()) {
    throw new Error('VITE_API_BASE_URL is missing or empty');
  }
  const url = resolveUrl(BASE, path);
  const res = await fetch(url, { credentials: 'include' });
  // ...
}
```

File: `src/components/GoogleLoginButton.tsx`
```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL;
// ...
const r = await fetch(`${API_BASE}/auth/google`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ idToken })
});
```

**Connection Flow**:
```
Frontend (Vite Dev Server)  ->  VITE_API_BASE_URL  ->  Backend (Express)
localhost:5173                   http://localhost:8080         port 8080
```

**Production Deployment**:
- Frontend and backend are **same-site** (same origin)
- `SESSION_COOKIE_SAMESITE=lax` is correct for same-site
- `credentials: "include"` sends cookies for same-site requests

**Integration Implication**:
- Add backend env vars:
  ```
  MIDTRANS_CLIENT_KEY
  MIDTRANS_SERVER_KEY
  MIDTRANS_ENVIRONMENT          (sandbox/production)
  MIDTRANS_PAYMENT_URL          (derived, or explicit)
  ```
- Frontend may need:
  ```
  VITE_MIDTRANS_CLIENT_KEY      (for Midtrans.js 3DS)
  ```
- Webhook URL must be publicly accessible
- Midtrans Dashboard configuration required for webhook endpoint

---

### 2.7 Deployment Notes

**Platform**: Google Cloud Run (from `docs/report_2026_02_05_auth_session_postgres.md`)

**Detection**: `isProd()` function (lines 84-86)
```typescript
function isProd() {
  return Boolean(process.env.K_SERVICE) || process.env.NODE_ENV === "production";
}
```

**Entry Point**:
- Build: `npm run build` -> `tsc` -> compiles to `dist/index.js`
- Start: `npm run start` -> `node dist/index.js`
- Default port: 8080 (configurable via `PORT` env var)

**Database**: Cloud SQL (PostgreSQL)
- Connection: Cloud SQL Connector with Public IP
- Auth: IAM-based (no password in connection string)
- Pool: Singleton `pg` Pool

**CORS for Production**:
- `ALLOWED_ORIGINS` must be set if frontend is on different origin
- Example: `ALLOWED_ORIGINS=https://arnvoid.example.com`
- If same-site (frontend and backend on same domain), `ALLOWED_ORIGINS` can be unset

**No Path Rewrites**: Backend is NOT behind a proxy
- Routes are at root: `/auth/google`, `/me`, etc.
- Webhook should be at: `/api/payments/webhook` or similar

**Webhook CORS Considerations**:
- Midtrans servers will call webhook from external origin
- Webhook endpoint must accept requests without auth cookie
- Signature verification is the ONLY security mechanism
- CORS should be configured to allow Midtrans IP addresses (or disable for specific webhook path)

**Integration Implication**:
- Webhook endpoint must be publicly accessible
- Consider disabling CORS auth requirement for webhook path
- Add Midtrans IP whitelist to firewall/security rules
- Webhook URL format: `https://backend.example.com/api/payments/webhook`

---

## 3. Midtrans Protocol Notes

### 3.1 API Endpoints

**Sandbox**: `https://api.sandbox.midtrans.com/v2/charge`
**Production**: `https://api.midtrans.com/v2/charge`

**Authorization Header**:
```http
Authorization: Basic AUTH_STRING
```
Where `AUTH_STRING = Base64Encode("SERVER_KEY" + ":")`

**Example**:
```
Server Key: "Mid-server-ABC123"
Encoded: Base64Encode("Mid-server-ABC123:") = "TWlkLXNlcnZlci1BQkMxMjM6"
```

### 3.2 Charge API (Create Transaction)

**Request (Bank Transfer)**:
```json
POST /v2/charge
{
  "payment_type": "bank_transfer",
  "transaction_details": {
    "order_id": "ORDER-101",
    "gross_amount": 50000
  },
  "bank_transfer": {
    "bank": "bca"  // bca, bni, bri, permata, cimb, mandiri (echannel)
  },
  "customer_details": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "[email protected]",
    "phone": "08123456789"
  }
}
```

**Response (BCA VA)**:
```json
{
  "status_code": "201",
  "status_message": "Success, Bank Transfer transaction is created",
  "transaction_id": "be03df7d-2f97-4c8c-a53c-8959f1b67295",
  "order_id": "ORDER-101",
  "gross_amount": "50000.00",
  "currency": "IDR",
  "payment_type": "bank_transfer",
  "transaction_time": "2019-10-23 16:33:49",
  "transaction_status": "pending",
  "va_numbers": [
    {
      "bank": "bca",
      "va_number": "812785002530231"
    }
  ],
  "fraud_status": "accept"
}
```

**Request (Credit Card)**:
```json
POST /v2/charge
{
  "payment_type": "credit_card",
  "transaction_details": {
    "order_id": "ORDER-102",
    "gross_amount": 100000
  },
  "credit_card": {
    "token_id": "<token from Midtrans.js>",
    "authentication": true  // Enable 3DS
  },
  "customer_details": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "[email protected]",
    "phone": "08123456789"
  }
}
```

**Response (Card with 3DS)**:
```json
{
  "status_code": "201",
  "status_message": "Success, Credit Card transaction is successful",
  "transaction_id": "0bb563a9-ebea-41f7-ae9f-d99ec5f9700a",
  "order_id": "ORDER-102",
  "redirect_url": "https://api.sandbox.veritrans.co.id/v2/token/rba/redirect/...",
  "gross_amount": "100000.00",
  "currency": "IDR",
  "payment_type": "credit_card",
  "transaction_time": "2019-08-27 15:50:54",
  "transaction_status": "pending",
  "fraud_status": "accept",
  "masked_card": "481111 1114",
  "bank": "bni",
  "card_type": "credit"
}
```

### 3.3 Get Status API

**Endpoint**: `GET /v2/{order_id}/status`

**Response**:
```json
{
  "status_code": "200",
  "status_message": "Success, transaction found",
  "transaction_id": "be03df7d-2f97-4c8c-a53c-8959f1b67295",
  "order_id": "ORDER-101",
  "gross_amount": "50000.00",
  "payment_type": "bank_transfer",
  "transaction_status": "settlement",
  "transaction_time": "2019-10-23 16:33:49",
  "settlement_time": "2019-10-23 16:45:00"
}
```

### 3.4 HTTP Notification (Webhook)

**Method**: POST
**Content-Type**: application/json
**Signature Key**: SHA512 hash of `order_id + status_code + gross_amount + Server Key`

**Request Body**:
```json
{
  "status_code": "200",
  "status_message": "Success, transaction found",
  "transaction_id": "be03df7d-2f97-4c8c-a53c-8959f1b67295",
  "order_id": "ORDER-101",
  "gross_amount": "50000.00",
  "payment_type": "bank_transfer",
  "transaction_status": "settlement",
  "transaction_time": "2019-10-23 16:33:49",
  "settlement_time": "2019-10-23 16:45:00",
  "signature_key": "a1b2c3d4e5f6..."  // SHA512 hash
}
```

**Signature Verification** (Node.js):
```typescript
import crypto from "crypto";

function verifySignature(
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

**Critical Security Notes**:
- Always verify signature before processing
- Return HTTP 200 even if processing fails (Midtrans will retry)
- Handle duplicate notifications (idempotency)
- Log all webhook deliveries for reconciliation

---

## 4. Payment State Machine Mapping to Arnvoid

### 4.1 Midtrans Transaction Status

| Status | Description | Arnvoid Action |
|--------|-------------|----------------|
| `pending` | Transaction created, awaiting payment | Show payment instructions (VA number) or redirect to 3DS |
| `settlement` | Payment successful | Credit user account, mark transaction paid |
| `capture` | Card payment successful (no 3DS) | Credit user account, mark transaction paid |
| `deny` | Transaction rejected by bank/fraud | Show error, do not credit |
| `expire` | Payment not completed in time | Show expired message, do not credit |
| `cancel` | Cancelled by merchant | Refund if applicable, do not credit |

### 4.2 Proposed Arnvoid Transaction Status

```sql
CREATE TYPE transaction_status AS ENUM (
  'created',      -- Initial state, Midtrans charge initiated
  'pending',      -- Awaiting payment (from Midtrans)
  'paid',         -- Payment confirmed (settlement/capture)
  'failed',       -- Payment failed/rejected (deny/expire)
  'cancelled',    -- Cancelled by user/admin
  'refunded'      -- Refunded (if applicable)
);
```

### 4.3 State Transitions

```
[created] -> [pending]   (Midtrans returns pending)
[created] -> [paid]      (Midtrans returns capture - no 3DS)
[pending] -> [paid]      (Webhook: settlement)
[pending] -> [failed]    (Webhook: deny/expire)
[created] -> [cancelled] (User cancels before payment)
[paid]     -> [refunded] (Admin initiates refund)
```

### 4.4 Credit Balance State Machine

```sql
CREATE TABLE credit_balances (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'purchase', 'usage', 'refund', 'bonus'
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Credit Rules**:
- Purchase: Add balance (when payment confirmed)
- Usage: Deduct balance (when analysis performed)
- Refund: Deduct balance (when payment refunded)
- Bonus: Add balance (promotional credits, admin action)

---

## 5. Idempotency/Double-Credit Prevention Plan

### 5.1 Threat Model

**Double Payment Scenarios**:
1. User clicks "Pay" twice rapidly
2. Network timeout causes retry
3. Webhook notification sent multiple times
4. Race condition between webhook and status poll

**Double Credit Scenarios**:
1. Webhook processed twice
2. Webhook + status poll both trigger credit
3. Manual credit adjustment after webhook

### 5.2 Prevention Strategy

#### A. Database Constraints (Primary Defense)

```sql
-- Unique constraint on order_id prevents duplicate transactions
ALTER TABLE transactions
ADD CONSTRAINT transactions_order_id_key UNIQUE (order_id);

-- Unique constraint on midtrans transaction_id
ALTER TABLE transactions
ADD CONSTRAINT transactions_midtrans_transaction_id_key UNIQUE (midtrans_transaction_id);

-- Unique constraint on credit transaction per payment
ALTER TABLE credit_transactions
ADD CONSTRAINT credit_transactions_transaction_id_key UNIQUE (transaction_id);

-- Check constraint prevents negative balance
ALTER TABLE credit_balances
ADD CONSTRAINT credit_balances_balance_nonnegative CHECK (balance >= 0);
```

#### B. Idempotent Transaction Creation

```typescript
async function createTransaction(userId: bigint, amount: number): Promise<Transaction> {
  const orderId = generateOrderId();  // ARNV-{timestamp}-{random}

  // Use INSERT ... ON CONFLICT to handle duplicate order_id
  const result = await pool.query(
    `INSERT INTO transactions (user_id, order_id, gross_amount, status)
     VALUES ($1, $2, $3, 'created')
     ON CONFLICT (order_id) DO UPDATE SET
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, orderId, amount]
  );

  return result.rows[0];
}
```

#### C. Idempotent Webhook Processing

```typescript
async function handleWebhook(payload: WebhookPayload): Promise<void> {
  const { order_id, transaction_status, signature_key } = payload;

  // 1. Verify signature first (fail fast)
  if (!verifySignature(order_id, payload.status_code, payload.gross_amount, signature_key)) {
    throw new Error('Invalid signature');
  }

  // 2. Check if already processed (idempotency)
  const existing = await pool.query(
    `SELECT id, status, credited FROM transactions WHERE order_id = $1`,
    [order_id]
  );

  if (existing.rows.length > 0) {
    const tx = existing.rows[0];

    // Already credited - skip
    if (tx.credited) {
      console.log(`[webhook] already credited: ${order_id}`);
      return;
    }

    // Status unchanged - skip
    if (tx.status === transaction_status) {
      console.log(`[webhook] status unchanged: ${order_id}`);
      return;
    }
  }

  // 3. Process new status
  await pool.query(
    `UPDATE transactions
     SET status = $1,
         midtrans_transaction_id = $2,
         midtrans_response = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE order_id = $4`,
    [transaction_status, payload.transaction_id, JSON.stringify(payload), order_id]
  );

  // 4. Credit if settled (in a transaction with rollback)
  if (transaction_status === 'settlement' || transaction_status === 'capture') {
    await creditUser(order_id);
  }
}
```

#### D. Idempotent Credit Application

```typescript
async function creditUser(orderId: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the transaction row
    const txResult = await client.query(
      `SELECT id, user_id, gross_amount, credited
       FROM transactions
       WHERE order_id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (txResult.rows.length === 0) {
      throw new Error(`Transaction not found: ${orderId}`);
    }

    const tx = txResult.rows[0];

    // Double-check credited flag
    if (tx.credited) {
      console.log(`[credit] already credited: ${orderId}`);
      await client.query('ROLLBACK');
      return;
    }

    // Credit the user
    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, type, transaction_id)
       VALUES ($1, $2, 'purchase', $3)`,
      [tx.user_id, tx.gross_amount, tx.id]
    );

    await client.query(
      `INSERT INTO credit_balances (user_id, balance)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         balance = credit_balances.balance + $2,
         updated_at = CURRENT_TIMESTAMP`,
      [tx.user_id, tx.gross_amount]
    );

    // Mark as credited
    await client.query(
      `UPDATE transactions
       SET credited = true,
           credited_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [tx.id]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

#### E. Status Polling Fallback

```typescript
async function checkTransactionStatus(orderId: string): Promise<void> {
  // Call Midtrans GET /v2/{order_id}/status
  const response = await fetch(`${MIDTRANS_API_URL}/v2/${orderId}/status`, {
    headers: {
      'Authorization': `Basic ${AUTH_STRING}`,
      'Accept': 'application/json'
    }
  });

  const data = await response.json();

  // Process same as webhook (reuse handleWebhook logic)
  await handleTransactionStatusUpdate(data);
}
```

### 5.3 Logging for Reconciliation

```sql
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  signature VARCHAR(255) NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_logs_order_id ON webhook_logs(order_id);
```

```typescript
// Log ALL webhook deliveries before processing
await pool.query(
  `INSERT INTO webhook_logs (order_id, payload, signature, signature_valid)
   VALUES ($1, $2, $3, $4)`,
  [order_id, JSON.stringify(payload), signature_key, isValid]
);
```

---

## 6. Proposed Backend Endpoints

### 6.1 Payment Creation

**Endpoint**: `POST /api/payments/create`

**Authentication**: Required (session cookie)

**Request**:
```typescript
{
  amount: number;           // Gross amount in IDR (e.g., 50000)
  paymentType: 'bank_transfer' | 'credit_card';
  bank?: string;            // For bank_transfer: 'bca' | 'bni' | 'bri' | 'permata' | 'cimb'
  customerDetails?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  // For credit card:
  tokenId?: string;         // From Midtrans.js getCardToken()
}
```

**Response** (Bank Transfer):
```typescript
{
  ok: true;
  transaction: {
    id: string;              // Internal UUID
    orderId: string;         // Midtrans order ID
    amount: number;
    status: 'pending';
    paymentType: 'bank_transfer';
    bank: string;
    vaNumber: string;        // VA number for payment
    expiryTime: Date;        // 24 hours from creation
    createdAt: Date;
  };
}
```

**Response** (Credit Card with 3DS):
```typescript
{
  ok: true;
  transaction: {
    id: string;
    orderId: string;
    amount: number;
    status: 'pending';
    paymentType: 'credit_card';
    redirectUrl: string;      // 3DS authentication URL
    maskedCard: string;
    createdAt: Date;
  };
}
```

**Response** (Credit Card without 3DS):
```typescript
{
  ok: true;
  transaction: {
    id: string;
    orderId: string;
    amount: number;
    status: 'paid';           // Already paid
    paymentType: 'credit_card';
    maskedCard: string;
    paidAt: Date;
    createdAt: Date;
  };
}
```

**Error Response**:
```typescript
{
  ok: false;
  error: string;              // Error message
}
```

### 6.2 Payment Status

**Endpoint**: `GET /api/payments/:transactionId`

**Authentication**: Required (session cookie, must own transaction)

**Response**:
```typescript
{
  ok: true;
  transaction: {
    id: string;
    orderId: string;
    amount: number;
    status: 'created' | 'pending' | 'paid' | 'failed' | 'cancelled';
    paymentType: string;
    paymentDetails: {
      bank?: string;
      vaNumber?: string;
      maskedCard?: string;
    };
    midtransStatus?: string;  // Raw Midtrans status
    credited: boolean;
    createdAt: Date;
    updatedAt: Date;
    paidAt?: Date;
  };
}
```

### 6.3 Webhook Handler

**Endpoint**: `POST /api/payments/webhook`

**Authentication**: Signature verification (no session cookie)

**Request**: Midtrans HTTP notification body

**Response**: Always HTTP 200 (even on error)
```typescript
{
  ok: true;  // Always true to prevent retry spam
}
```

**Behavior**:
1. Verify SHA512 signature
2. Log to `webhook_logs`
3. Update transaction status
4. Credit user if paid (idempotent)
5. Return 200

### 6.4 User Transaction History

**Endpoint**: `GET /api/payments/user`

**Authentication**: Required (session cookie)

**Query Params**:
```
?limit=20&offset=0&status=paid
```

**Response**:
```typescript
{
  ok: true;
  transactions: [
    {
      id: string;
      orderId: string;
      amount: number;
      status: string;
      paymentType: string;
      createdAt: Date;
      paidAt?: Date;
    }
  ];
  total: number;
  limit: number;
  offset: number;
}
```

### 6.5 Credit Balance

**Endpoint**: `GET /api/credits/balance`

**Authentication**: Required (session cookie)

**Response**:
```typescript
{
  ok: true;
  balance: number;      // Current credit balance
  currency: string;     // "IDR"
}
```

### 6.6 Credit History

**Endpoint**: `GET /api/credits/history`

**Authentication**: Required (session cookie)

**Query Params**:
```
?limit=20&offset=0&type=purchase
```

**Response**:
```typescript
{
  ok: true;
  transactions: [
    {
      id: string;
      amount: number;
      type: 'purchase' | 'usage' | 'refund' | 'bonus';
      transactionId?: string;  // Reference to payment transaction
      createdAt: Date;
    }
  ];
  total: number;
  limit: number;
  offset: number;
}
```

---

## 7. Logging/Debug Probes

### 7.1 Log Tags

Follow existing pattern from auth code:
```typescript
console.log(`[server] listening on ${port}`);
console.log(`[cors] allowed origin: ${origin}`);
console.log(`[auth] session missing -> cleared cookie`);
```

**Proposed Tags**:
```typescript
[payment]    - Payment operations
[webhook]    - Webhook processing
[midtrans]   - Midtrans API calls
[credit]     - Credit operations
[idempotent] - Idempotency checks
```

### 7.2 Critical Logs

**Payment Creation**:
```typescript
console.log(`[payment] created order_id=${orderId} user_id=${userId} amount=${amount}`);
console.log(`[midtrans] charge request order_id=${orderId}`);
console.log(`[midtrans] charge response order_id=${orderId} status=${status}`);
```

**Webhook Processing**:
```typescript
console.log(`[webhook] received order_id=${orderId} status=${status}`);
console.log(`[webhook] signature valid=${valid} order_id=${orderId}`);
console.log(`[webhook] idempotency_check already_credited=${credited} order_id=${orderId}`);
console.log(`[webhook] processing status=${status} order_id=${orderId}`);
```

**Credit Application**:
```typescript
console.log(`[credit] crediting user_id=${userId} amount=${amount} order_id=${orderId}`);
console.log(`[credit] credited user_id=${userId} new_balance=${balance}`);
console.log(`[idempotent] already credited order_id=${orderId}`);
```

**Error Cases**:
```typescript
console.error(`[payment] failed order_id=${orderId} error=${error.message}`);
console.error(`[webhook] signature_invalid order_id=${orderId}`);
console.error(`[webhook] processing_failed order_id=${orderId} error=${error.message}`);
```

### 7.3 Structured Logging (Optional Enhancement)

```typescript
interface LogContext {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  tag: string;
  orderId?: string;
  userId?: bigint;
  amount?: number;
  status?: string;
  error?: string;
  durationMs?: number;
}

function logPaymentEvent(ctx: LogContext): void {
  console.log(JSON.stringify(ctx));
}
```

### 7.4 Metrics to Track

**Business Metrics**:
- Total payment volume
- Success rate by payment method
- Average transaction value
- Credit balance distribution

**Technical Metrics**:
- API response time (Midtrans)
- Webhook processing time
- Signature verification failures
- Idempotency hits (duplicate notifications)

**Alerts**:
- High webhook failure rate (> 1%)
- Signature verification failures (> 0.1%)
- Payment creation failures (> 5%)
- Credit application errors (> 0.1%)

---

## 8. Open Questions

### 8.1 Product/Business Model

**Q1**: What is Arnvoid selling?
- [ ] Credits (consumable resource for analysis)
- [ ] Subscription (recurring access)
- [ ] One-time purchase (lifetime access)
- [ ] Usage-based (pay per analysis)

**Q2**: How much does analysis cost?
- [ ] Fixed price per analysis
- [ ] Tiered pricing (basic vs advanced)
- [ ] Custom pricing based on document size
- [ ] Free tier with paid upgrades

**Q3**: What is the credit model?
- [ ] 1 credit = 1 analysis
- [ ] Credits based on analysis duration
- [ ] Credits based on document complexity
- [ ] Credits expire after X days

**Recommendation**: Start with simple model
- Credit packages: 100, 500, 1000 credits
- Price points: Rp 50k, Rp 200k, Rp 350k
- 1 credit = 1 document analysis
- Credits never expire

### 8.2 Payment Methods

**Q4**: Which payment methods for MVP?
- [ ] Bank Transfer only (simplest)
- [ ] Bank Transfer + Credit Card
- [ ] All methods (including E-Wallet)

**Q5**: Need recurring payments?
- [ ] Yes (subscription model)
- [ ] No (one-time purchases)

**Recommendation**: Start with Bank Transfer (BCA, BNI, BRI)
- No 3DS complexity
- No frontend tokenization
- Simple VA number display
- Add Credit Card in phase 2

### 8.3 Webhook Deployment

**Q6**: What is the production webhook URL?
- [ ] https://arnvoid-backend.example.com/api/payments/webhook
- [ ] https://api.arnvoid.com/payments/webhook
- [ ] Need to set up domain first

**Q7**: Is Midtrans Core API activated for production?
- [ ] Yes (sandbox credentials are just for testing)
- [ ] No (need to request activation)

**Recommendation**: Configure webhook URL in Midtrans Dashboard
- Sandbox: Use ngrok or similar for local testing
- Production: Use public HTTPS endpoint

### 8.4 Database Schema

**Q8**: Who creates the new tables?
- [ ] Manual SQL execution
- [ ] Migration system (need to choose one)
- [ ] Cloud SQL auto-setup on first deploy

**Q9**: What is the initial credit balance for new users?
- [ ] Zero (pay-to-play)
- [ ] Free trial credits (e.g., 5 credits)
- [ ] Referral bonus

**Recommendation**: Add migration system
- Use simple SQL files in `src/server/db/migrations/`
- Track applied migrations in `schema_migrations` table
- Run migrations on server startup or separate command

### 8.5 Error Handling

**Q10**: What happens when payment fails?
- [ ] Show error, let user retry
- [ ] Save failed transaction for review
- [ ] Send notification to admin

**Q11**: What happens when credit balance is zero?
- [ ] Block analysis, show payment prompt
- [ ] Allow limited analysis with watermark
- [ ] Graceful degradation

**Recommendation**: Implement before payment integration
- Add credit check before analysis
- Show payment UI when credits are low
- Store failed payment attempts for analytics

### 8.6 Testing

**Q12**: How to test in sandbox?
- [ ] Use Midtrans sandbox credentials (already have)
- [ ] Test with real bank apps (VA)
- [ ] Test with test card numbers (card)

**Q13**: Load testing strategy?
- [ ] Test webhook handling under load
- [ ] Simulate concurrent payment creations
- [ ] Test idempotency with duplicate webhooks

**Recommendation**: Create test script
- Use Midtrans test card: 4811 1111 1111 1114
- Use test VA numbers from Midtrans Dashboard
- Simulate webhook retry scenarios

---

## 9. File Structure Summary

### 9.1 Existing Backend Files

```
src/server/
  src/
    index.ts          - Express server, routes, auth logic (304 lines)
    db.ts             - PostgreSQL connection pool (32 lines)
  package.json        - Server dependencies
  tsconfig.json       - TypeScript config
  dist/               - Compiled JS (generated)
  node_modules/       - Dependencies (generated)
```

### 9.2 Proposed New Files

```
src/server/
  src/
    midtrans/
      index.ts        - Midtrans client initialization
      types.ts        - TypeScript types
      charge.ts       - Charge API wrapper
      webhook.ts      - Webhook handler
      signature.ts    - Signature verification
    routes/
      payments.ts     - Payment routes
    db/
      migrations/
        001_create_transactions.sql
        002_create_credit_balances.sql
        003_create_credit_transactions.sql
        004_create_webhook_logs.sql
```

### 9.3 Frontend Files

```
src/
  api.ts              - Existing apiGet helper
  auth/
    useAuth.ts        - Existing auth hook
  components/
    GoogleLoginButton.tsx  - Existing login
    PaymentButton.tsx      - [NEW] Payment trigger
    CreditBalance.tsx      - [NEW] Balance display
  store/
    documentStore.tsx  - Existing document state
    paymentStore.tsx   - [NEW] Payment state
```

---

## 10. Integration Sequence

### 10.1 Phase 1: Database + Core Backend

1. Create migration files
2. Apply migrations to database
3. Implement Midtrans client (charge + status)
4. Implement webhook handler
5. Add payment routes to Express
6. Test with sandbox credentials

**Acceptance**:
- Can create BCA VA payment
- Can receive webhook notification
- Can query payment status
- Database constraints prevent duplicates

### 10.2 Phase 2: Credit System

1. Implement credit balance queries
2. Implement credit application logic
3. Add idempotency checks
4. Test credit balance updates
5. Test double-payment prevention

**Acceptance**:
- Credits are added on payment
- Credits are deduplicated
- Balance never goes negative
- Idempotency works correctly

### 10.3 Phase 3: Frontend Integration

1. Create payment UI components
2. Wire up to backend API
3. Display VA numbers
4. Show payment status
5. Display credit balance
6. Add payment prompt on low balance

**Acceptance**:
- User can trigger payment
- User can see VA number
- User can check payment status
- User can see credit balance

### 10.4 Phase 4: Credit Card Support

1. Include Midtrans.js
2. Implement card input form
3. Implement getCardToken flow
4. Handle 3DS authentication
5. Test with sandbox card

**Acceptance**:
- User can pay with card
- 3DS authentication works
- Card payment status updates
- Webhook handles card payments

### 10.5 Phase 5: Production Hardening

1. Configure production webhook URL
2. Set up monitoring and alerts
3. Load test webhook endpoint
4. Test with real payment (small amount)
5. Set up reconciliation process
6. Document runbook for incidents

**Acceptance**:
- System is production-ready
- Error rate < 0.1%
- Webhook processing < 100ms
- Monitoring covers all critical paths

---

## 11. Security Checklist

- [ ] Server Key never logged or exposed in error messages
- [ ] Webhook signature verified before processing
- [ ] All payment creation requires authenticated session
- [ ] Order ID format prevents collisions
- [ ] Database constraints prevent duplicate transactions
- [ ] SQL injection prevention (parameterized queries only)
- [ ] CORS configured to prevent unauthorized origins
- [ ] Webhook endpoint accessible to Midtrans IPs only
- [ ] Rate limiting on payment creation endpoint
- [ ] Audit logging for all payment operations
- [ ] Error messages do not leak sensitive information
- [ ] HTTPS only in production
- [ ] Session cookies are httpOnly and secure

---

## 12. References

### 12.1 Internal Documentation

- `docs/system.md` - System architecture
- `docs/repo_xray.md` - Repository structure
- `docs/report_2026_02_05_auth_session_postgres.md` - Auth implementation
- `docs/BACKEND_TODO.md` - Backend tasks

### 12.2 Midtrans Documentation

- [Core API Overview](https://docs.midtrans.com/docs/custom-interface-core-api)
- [Bank Transfer Integration](https://docs.midtrans.com/docs/coreapi-core-api-bank-transfer-integration)
- [Card Payment Integration](https://docs.midtrans.com/docs/coreapi-card-payment-integration)
- [HTTP(S) Notification/Webhooks](https://docs.midtrans.com/docs/http-s-notification-webhooks)
- [API Authorization & Headers](https://docs.midtrans.com/docs/api-authorization-headers)

### 12.3 Key Code Locations

- Backend entry: `src/server/src/index.ts:1`
- Database pool: `src/server/src/db.ts:1`
- Auth hook: `src/auth/useAuth.ts:1`
- API helper: `src/api.ts:1`
- Login button: `src/components/GoogleLoginButton.tsx:1`

---

**End of Forensic Report**

Next step: Review and approve this report before implementation begins.
