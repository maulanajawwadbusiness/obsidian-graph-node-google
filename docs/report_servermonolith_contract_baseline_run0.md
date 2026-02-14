# Run0 Contract Baseline: ServerMonolith Parity Bible

Date: 2026-02-14
Branch: wire-onboarding-screen-backend-refactoring
Scope: docs-only baseline lock for backend parity during modularization
Code changes: none

## 1) Route Inventory Table (Complete)

| Method | Path | Auth? | Notes |
| --- | --- | --- | --- |
| POST | /api/payments/webhook | No | Registered before CORS. Uses global JSON parser path (not saved-interfaces parser). Signature check + webhook event persistence flow. |
| GET | /health | No | Registered after CORS + preflight wiring. DB ping endpoint. |
| POST | /auth/google | No | Registered after CORS. Sets arnvoid_session cookie on success. Includes displayName and username only when profileColumnsAvailable is true. |
| GET | /me | No | Registered after CORS. Source of truth for frontend auth state. Returns user null when no valid session. |
| POST | /auth/logout | No | Registered after CORS. Deletes session row and clears arnvoid_session cookie. |
| POST | /api/profile/update | Yes (requireAuth) | Registered after CORS. Returns 503 when profileColumnsAvailable is false. |
| GET | /api/saved-interfaces | Yes (requireAuth) | Registered after CORS. Uses dedicated /api/saved-interfaces parser chain from app-level middleware. |
| POST | /api/saved-interfaces/upsert | Yes (requireAuth) | Registered after CORS. Enforces serialized payload byte guard and parser guard. |
| POST | /api/saved-interfaces/delete | Yes (requireAuth) | Registered after CORS. Uses dedicated /api/saved-interfaces parser chain from app-level middleware. |
| GET | /api/rupiah/me | Yes (requireAuth) | Registered after CORS. Returns current rupiah balance snapshot. |
| POST | /api/payments/gopayqris/create | Yes (requireAuth) | Registered after CORS. Creates transaction row then calls Midtrans charge API. |
| POST | /api/llm/paper-analyze | Yes (requireAuth) | Route body in routes/llmAnalyzeRoute.ts. Structured JSON endpoint. Not streaming. |
| GET | /api/payments/:orderId/status | Yes (requireAuth) | Registered after analyze registration and before prefill/chat registrations. |
| POST | /api/llm/prefill | Yes (requireAuth) | Route body in routes/llmPrefillRoute.ts. Non-streaming text suggestion endpoint. |
| POST | /api/llm/chat | Yes (requireAuth) | Route body in routes/llmChatRoute.ts. Streaming plain-text response. Uses req.on("close") cancellation path and finalize in finally. |

Header quirks preserved (current behavior):
- Retry-After on LLM 429: set via sendApiError options in analyze, prefill, and chat.
- X-Request-Id is not fully uniform across all branches:
  - sendApiError paths include X-Request-Id.
  - analyze sets X-Request-Id explicitly on success and 402 branches.
  - prefill sets X-Request-Id explicitly on success; 402 branches do not explicitly set it.
  - chat sets X-Request-Id on streaming success path; 402 precheck branch does not explicitly set it.

## 2) Middleware and Ordering Invariants (Must Not Drift)

Registration order in src/server/src/serverMonolith.ts:
1. `app.use("/api/saved-interfaces", savedInterfacesJsonParser)`
2. `app.use(...)` global JSON gate:
   - skips /api/saved-interfaces
   - applies globalJsonParser to all other paths
3. `app.use(error-handler...)` entity.too.large handling:
   - if path starts with /api/saved-interfaces, respond 413 with `{ ok:false, error:"saved interface payload too large" }`
4. `app.post("/api/payments/webhook", ...)` registered before CORS
5. `app.use(cors(corsOptions))`
6. `app.options(/.*/, cors(corsOptions))`
7. Remaining routes in registered order (health, auth, profile, saved interfaces, rupiah, payments, llm registrations)

Additional order-sensitive wiring:
- LLM registration order is currently:
  1. registerLlmAnalyzeRoute
  2. /api/payments/:orderId/status
  3. registerLlmPrefillRoute
  4. registerLlmChatRoute
- Keep this exact sequence unless intentional and audited.

Parser and limit invariants:
- savedInterfacesJsonParser limit: SAVED_INTERFACE_JSON_LIMIT (default "15mb")
- globalJsonParser limit: LLM_LIMITS.jsonBodyLimit (currently "2mb")
- saved interface upsert also has serialized payload byte guard:
  - MAX_SAVED_INTERFACE_PAYLOAD_BYTES default 15 * 1024 * 1024

## 3) Startup Gate Invariants

Startup sequence in startServer() must remain:
1. `assertAuthSchemaReady()`
2. `detectProfileColumnsAvailability()`
3. `app.listen(port, ...)`

Failure behavior:
- on startup failure, log fatal and exit(1)

profileColumnsAvailable usage contract:
- /auth/google:
  - when true: user upsert returns display_name and username and response includes displayName/username
  - when false: user upsert query excludes those columns
- /me:
  - query shape switches based on profileColumnsAvailable
  - response includes displayName and username only when available
- /api/profile/update:
  - hard gate returns 503 when profileColumnsAvailable is false

## 4) Auth and Cookie Contract

Cookie contract:
- cookie name default: arnvoid_session
- env override: SESSION_COOKIE_NAME
- set and clear options include:
  - httpOnly true
  - sameSite lax (normalized)
  - secure based on prod detection
  - path /

Auth state contract:
- /me is source of truth for logged-in state on frontend
- frontend requests must use credentials: "include"

/me payload contract:
- signed-in user fields:
  - sub
  - email
  - name
  - picture
  - displayName (when profile columns available)
  - username (when profile columns available)
- does not include DB numeric id
- returns `{ ok:true, user:null }` when session missing/invalid/expired and may clear cookie on invalid/expired session

## 5) Saved Interfaces Contract

API routes:
- GET /api/saved-interfaces
- POST /api/saved-interfaces/upsert
- POST /api/saved-interfaces/delete

Size guard invariants:
- parser-level guard for /api/saved-interfaces via dedicated parser limit (default 15mb)
- explicit entity.too.large handler returns 413 for /api/saved-interfaces
- upsert branch-level serialized byte guard returns 413 when payload exceeds MAX_SAVED_INTERFACE_PAYLOAD_BYTES

Ordering truth invariant (product-level):
- UI ordering truth is payload timestamps inside payload_json (not DB row updated_at metadata)
- backend list currently returns DB created_at and updated_at as metadata; do not treat these as frontend ordering source of truth

## 6) Payments Contract

Routes:
- POST /api/payments/gopayqris/create
- GET /api/payments/:orderId/status
- POST /api/payments/webhook

Webhook behavior invariants:
- webhook route stays before CORS registration
- verify signature using sha512(order_id + status_code + gross_amount + server_key)
- persist webhook event row first
- update payment_transactions when signature is verified and order_id exists
- apply topup on paid statuses (settlement/capture)
- finalize payment_webhook_events.processed and processing_error

Status route behavior invariants:
- pending status may call Midtrans status API
- transaction row may be updated from Midtrans result
- paid transition may trigger topup apply attempt

Create route behavior invariants:
- create transaction row before Midtrans charge
- on charge failure, transaction status updated to failed and response returns 502

## 7) Current Monolith Anatomy Quick Map

File: src/server/src/serverMonolith.ts (968 lines)

Approximate section map:
- 1-77: imports, constants, limits, parser objects
- 78-93: parser middleware chain and saved-interfaces overlimit handling
- 95-283: cors options and shared helper/auth utility functions
- 284-393: payments webhook route (pre-CORS)
- 394-395: CORS middleware + preflight wiring
- 397-799: health, auth, /me, logout, profile, saved-interfaces routes
- 800-941: rupiah and payments create route
- 914-941: llm deps wiring object construction
- 942: registerLlmAnalyzeRoute
- 944-1054: payments status route
- 1055-1056: registerLlmPrefillRoute and registerLlmChatRoute
- 1058-1075: startup gate and listen sequence

LLM route bodies live in:
- src/server/src/routes/llmAnalyzeRoute.ts
- src/server/src/routes/llmPrefillRoute.ts
- src/server/src/routes/llmChatRoute.ts

This baseline is the parity reference for upcoming modularization work. Any behavior change must be explicitly called out against this document.
