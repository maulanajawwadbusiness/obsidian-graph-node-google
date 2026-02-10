# Report 2026-02-10: Google Memory Saved Interfaces Forensic v2

## Scope

This report is forensic only. No implementation.

Goal:
- move saved interfaces from localStorage-only to account-backed memory using:
  - Google sign-in identity
  - Arnvoid backend session cookie
  - Postgres user row
- store in Arnvoid backend DB keyed by authenticated user
- not Google Drive

Constraints honored:
- no browser testing tool use
- no code mutation for feature implementation
- no commits in this step

---

## 1) Current Truth Map

## 1.1 Where saved sessions are written today

Analysis success write path:
- `src/document/nodeBinding.ts:207` builds dedupe key
- `src/document/nodeBinding.ts:214` writes via `upsertSavedInterface(...)`
- payload currently includes `parsedDocument.text` (`src/document/nodeBinding.ts:187`)

Layout patch write path:
- `src/playground/GraphPhysicsPlayground.tsx:629` capture function
- reads current saved list by doc id: `src/playground/GraphPhysicsPlayground.tsx:635`
- writes layout and camera via `patchSavedInterfaceLayout(...)`: `src/playground/GraphPhysicsPlayground.tsx:653`

Rename write path:
- Sidebar action in AppShell calls title patch:
  - `src/screens/AppShell.tsx:510`
  - `src/screens/AppShell.tsx:511`

Delete write path:
- Delete confirm path calls `deleteSavedInterface(...)`:
  - `src/screens/AppShell.tsx:195`
  - `src/screens/AppShell.tsx:201`

Load/restore path:
- AppShell state source is local store:
  - `src/screens/AppShell.tsx:156`
  - `src/screens/AppShell.tsx:157`
- selection sets pending restore intent:
  - `src/screens/AppShell.tsx:170`
  - `src/screens/AppShell.tsx:173`
- graph consumes restore intent:
  - `src/playground/GraphPhysicsPlayground.tsx:798`

## 1.2 savedInterfacesStore schema/key/dedupe/cap truth

Storage key and cap:
- `SAVED_INTERFACES_KEY = "arnvoid_saved_interfaces_v1"`: `src/store/savedInterfacesStore.ts:4`
- `DEFAULT_SAVED_INTERFACES_CAP = 20`: `src/store/savedInterfacesStore.ts:5`

Record shape:
- `SavedInterfaceRecordV1`: `src/store/savedInterfacesStore.ts:19`
- includes full `parsedDocument` and full `topology`: `src/store/savedInterfacesStore.ts:28`, `src/store/savedInterfacesStore.ts:29`
- optional `layout` and `camera`: `src/store/savedInterfacesStore.ts:31`, `src/store/savedInterfacesStore.ts:34`
- dedupe field `dedupeKey`: `src/store/savedInterfacesStore.ts:45`

Validation and sanitation:
- runtime record validator: `src/store/savedInterfacesStore.ts:116`
- requires `parsedDocument.text` string: `src/store/savedInterfacesStore.ts:128`

Dedupe and ordering:
- dedupe key builder: `src/store/savedInterfacesStore.ts:232`
- upsert dedupe match by `dedupeKey`: `src/store/savedInterfacesStore.ts:289`
- newest-first sort by `updatedAt`, tie by `createdAt`: `src/store/savedInterfacesStore.ts:172`

Read/write local storage:
- read: `src/store/savedInterfacesStore.ts:245`
- write: `src/store/savedInterfacesStore.ts:269`
- quota warning path: `src/store/savedInterfacesStore.ts:277`

Patch helpers:
- delete: `src/store/savedInterfacesStore.ts:320`
- layout: `src/store/savedInterfacesStore.ts:327`
- rename title: `src/store/savedInterfacesStore.ts:352`

## 1.3 Auth flow truth

Frontend credentials discipline:
- GET helper includes cookie credentials: `src/api.ts:41`
- POST helper includes cookie credentials: `src/api.ts:90`
- Google login exchange includes credentials: `src/components/GoogleLoginButton.tsx:76`

Auth bootstrap and source of truth:
- `AuthProvider` calls `/me`: `src/auth/AuthProvider.tsx:54`
- refresh on focus: `src/auth/AuthProvider.tsx:130`

Backend auth/session:
- cookie name `arnvoid_session`: `src/server/src/index.ts:49`
- `requireAuth` middleware: `src/server/src/index.ts:357`
- Google login endpoint: `src/server/src/index.ts:510`
- user upsert query: `src/server/src/index.ts:575`
- session insert query: `src/server/src/index.ts:590`
- `/me` endpoint: `src/server/src/index.ts:620`

---

## 2) Backend Readiness and Schema Drift Risk

## 2.1 Readiness

Good signs:
- authenticated middleware exists and is used by core APIs (`requireAuth`): `src/server/src/index.ts:357`
- query style is direct `pool.query(...)` with SQL literals in route handlers:
  - example read: `src/server/src/index.ts:367`
  - example insert: `src/server/src/index.ts:575`
- DB connector centralized in `src/server/src/db.ts:12`

Migration style:
- node-pg-migrate JS files in `src/server/migrations/*.js`
- existing migration examples show:
  - FK pattern to users table: `src/server/migrations/1770367000000_add_payment_tables.js:10`
  - index creation pattern: `src/server/migrations/1770367000000_add_payment_tables.js:52`

## 2.2 Drift risk (important)

Code assumes `users` and `sessions` exist:
- `insert into users ...`: `src/server/src/index.ts:575`
- `insert into sessions ...`: `src/server/src/index.ts:590`
- joins `sessions` -> `users`: `src/server/src/index.ts:636`

Tracked migrations do not define auth base tables:
- `src/server/migrations/1770332268745_init-tables.js` is empty (`up` no-op at line 11)

Evidence of implicit/manual provisioning:
- auth report documents expected `users`/`sessions` and manual SQL repair checks:
  - `docs/report_2026_02_05_auth_session_postgres.md:53`
  - `docs/report_2026_02_05_auth_session_postgres.md:70`

Forensic conclusion:
- environment drift risk is real
- any new saved session table migration must assume auth base tables exist but should be deployed with schema verification steps

---

## 3) Minimal DB Model Proposal (Option A preferred)

Table: `saved_interfaces`

Columns:
- `id uuid primary key`
- `user_id bigint not null references users(id) on delete cascade`
- `client_interface_id text not null`
- `title text not null`
- `doc_id text not null`
- `dedupe_key text not null`
- `payload_json jsonb not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints and indexes:
- `unique(user_id, client_interface_id)`
- index `(user_id, updated_at desc)`
- index `(user_id, doc_id)`
- index `(user_id, dedupe_key)` optional but recommended for dedupe lookup

Why this model:
- minimal diff from existing client payload contract
- idempotent upsert on client-owned id
- fast list by user recency

Payload-size and privacy risk (must call out):
- current payload includes full `parsedDocument.text` from save path (`src/document/nodeBinding.ts:187`)
- risks:
  - larger DB rows and slower sync
  - sensitive document retention in server DB

Server protections recommended:
1. max payload bytes check before write (hard reject 413)
2. optional policy toggle:
   - keep full text (high fidelity)
   - strip/reduce text (privacy and cost)
3. log only sizes and ids, never payload content

---

## 4) API Contract Proposal (requireAuth)

Auth rule:
- all endpoints below use `requireAuth` middleware (`src/server/src/index.ts:357`)

Endpoints:
1. `GET /api/saved-interfaces`
   - returns current user list ordered newest-first

2. `POST /api/saved-interfaces/upsert`
   - idempotent by `(user_id, client_interface_id)`
   - payload carries saved record metadata and `payload_json`

3. `POST /api/saved-interfaces/delete`
   - deletes by `client_interface_id` scoped to authenticated user

Optional later (recommended for noisy updates):
4. `POST /api/saved-interfaces/patch-title`
5. `POST /api/saved-interfaces/patch-layout`

Reason for optional patch endpoints:
- avoid rewriting full JSON blob on frequent layout updates

---

## 5) Frontend Sync Design (AppShell orchestrator)

## 5.1 Why AppShell owns orchestration

AppShell already owns:
- saved list state + refresh: `src/screens/AppShell.tsx:156`
- sidebar rename/delete actions: `src/screens/AppShell.tsx:510`, `src/screens/AppShell.tsx:514`
- selection and prompt->graph navigation: `src/screens/AppShell.tsx:170`

So AppShell is the correct "sync brain" layer.

## 5.2 Sync timing rules

On auth-ready boot:
- if logged in, fetch remote list and merge with local cache

On analysis save:
- local write immediate (existing behavior), then remote upsert

On rename/delete:
- local optimistic update, then remote mutation

On layout patch:
- throttle remote sync (layout can be frequent)

On logout/login switch:
- avoid cross-account bleed (see 5.4)

## 5.3 Merge and conflict rule

Rule:
- last-write-wins by `updatedAt`
- tie-breaker: prefer remote

Why:
- deterministic and simple
- favors cross-device consistency

## 5.4 Account switch isolation rule

Current local key is global:
- `arnvoid_saved_interfaces_v1` (`src/store/savedInterfacesStore.ts:4`)

Risk:
- account A local data can appear while account B is active

Minimal diff choices:
1. namespace local key by user identity (preferred)
2. clear local cache on account change then rehydrate from remote

---

## 6) Integration Seam Plan (No code yet)

## 6.1 `src/api.ts` additions

Planned client helpers:
- `getSavedInterfaces()`
- `upsertSavedInterfaceRemote(payload)`
- `deleteSavedInterfaceRemote(clientInterfaceId)`
- optional patch helpers:
  - `patchSavedInterfaceTitleRemote(...)`
  - `patchSavedInterfaceLayoutRemote(...)`

All must include `credentials: "include"` (existing helper pattern already does this).

## 6.2 AppShell changes (auth-aware orchestration)

Planned additions:
- consume `useAuth()` state in AppShell
- add initial hydration effect gated by auth state
- add sync queue/retry state for remote failures
- preserve existing `pendingLoadInterface` behavior and graph restore contract

## 6.3 Reroute or mirror write seams

Current write seams to unify:
1. analysis save: `src/document/nodeBinding.ts:214`
2. layout patch: `src/playground/GraphPhysicsPlayground.tsx:653`
3. rename/delete in AppShell: `src/screens/AppShell.tsx:510`, `src/screens/AppShell.tsx:201`

Plan:
- either centralize writes in AppShell service
- or keep local write at source and mirror remote write through AppShell callbacks/events

Critical:
- do not break restore pipeline in graph consume effect:
  - `src/playground/GraphPhysicsPlayground.tsx:798`

---

## 7) Architecture Diagram (Text)

```text
Google Sign-In
  -> POST /auth/google
  -> backend sets arnvoid_session cookie

Frontend boot
  -> AuthProvider GET /me (credentials include)
  -> user context established

AppShell sync orchestrator
  -> load local saved interfaces
  -> if authenticated: GET /api/saved-interfaces
  -> merge(local, remote) by updatedAt
  -> render Sidebar + Search from in-memory state

Write paths
  A) analysis success (nodeBinding) -> local upsert -> AppShell remote upsert
  B) rename/delete (Sidebar/AppShell) -> local patch/delete -> remote patch/delete
  C) layout patch (Graph) -> local patch -> throttled remote patch

Selection path (unchanged)
  Sidebar/Search click -> AppShell setPendingLoadInterface
  -> if prompt screen, navigate graph
  -> Graph consume pending restore and apply topology
```

---

## 8) Code Conflicts and Issues to Watch

1. multi-writer desync
- same data currently written from nodeBinding, graph, and AppShell
- missing one seam causes local/remote drift

2. schema drift
- auth base tables are assumed in runtime code but not in tracked init migration

3. payload size and sensitive text
- full text currently persisted locally and would move to backend unless policy changed

4. account bleed
- single global local key can mix multiple signed-in users over time

5. restore regression risk
- pending restore flow is stateful and guarded; timing changes can regress prompt->graph restore

---

## 9) Migration Outline (No code)

1. add migration file under `src/server/migrations/`
2. create `saved_interfaces` table with FK to `users(id)`
3. add unique and indexes listed in Section 3
4. include rollback (`down`) to drop table/indexes
5. apply via `npm run migrate` from `src/server` per `docs/db.md:66`

---

## 10) Endpoint Outline (No code)

`GET /api/saved-interfaces`
- auth required
- returns list scoped to `res.locals.user.id`

`POST /api/saved-interfaces/upsert`
- auth required
- validates payload and byte limit
- upsert by `(user_id, client_interface_id)`

`POST /api/saved-interfaces/delete`
- auth required
- delete where `user_id = current` and `client_interface_id = input`

Optional patch endpoints later:
- title patch
- layout patch

---

## 11) Must-Pass Tests (for implementation phase)

Auth and ownership:
1. unauthenticated calls to saved-interface API return 401 (`requireAuth`)
2. user A cannot read or delete user B sessions

Bootstrap and sync:
3. login -> AppShell hydrates from remote and renders list
4. logout -> no remote writes attempted; local policy applied as chosen
5. account switch does not show prior account sessions (no bleed)

Write paths:
6. analysis success creates session remotely and locally
7. rename propagates local and remote with same title
8. delete removes local and remote
9. layout updates sync remotely with throttle, no UI jank

Merge/conflict:
10. conflicting edits across devices resolve by updatedAt (tie -> remote)

Restore behavior:
11. selecting saved interface from prompt navigates to graph and restores correctly
12. selecting from graph restores in-place
13. failed remote sync does not break local restore path

Performance:
14. search overlay typing does not trigger localStorage reads per keystroke
15. sidebar/search list remains in-memory driven for zap performance

Safety:
16. no secrets in logs
17. no payload text logging

---

## 12) Final Forensic Verdict

The platform is ready to add account-backed memory for saved interfaces using existing cookie-session auth and user rows.

The highest risk is not API coding. It is write-path consistency across three current local writers plus schema drift between runtime assumptions and tracked migrations.

A minimal, safe path is:
- add `saved_interfaces` table and requireAuth CRUD
- make AppShell the sync orchestrator
- preserve current graph restore contract
- enforce payload-size guardrails and account-isolated local cache behavior

No feature implementation was performed in this report.

---

## 13) Step 1 Backend Safety Gate Implemented (2026-02-10)

What was added:
- Backend auth schema verifier:
  - `src/server/src/authSchemaGuard.ts`
- Startup fail-fast integration:
  - `src/server/src/serverMonolith.ts`
- Local run script:
  - `src/server/package.json` -> `npm run check:auth-schema`

What the guard verifies:
- required tables: `users`, `sessions`
- required columns:
  - `users`: `id`, `google_sub`, `email`, `name`, `picture`
  - `sessions`: `id`, `user_id`, `expires_at`
- compatibility checks for core types used by runtime auth path
- FK constraint: `sessions.user_id -> users.id`
- unique index/constraint presence:
  - `users.google_sub`
  - `sessions.id`

How to run locally:
1. from `src/server`, ensure DB env vars are set (`INSTANCE_CONNECTION_NAME`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`)
2. run:
   - `npm run check:auth-schema`
3. normal boot now also runs the same check before listen:
   - `npm run dev` or `npm run start`

Success output shape:
- `[auth-schema] ok ...` from CLI check
- `[auth-schema] ready ...` on server startup before `[server] listening on ...`

Failure output shape:
- startup exits non-zero with one clear fatal line:
  - `[auth-schema] fatal startup failure: [auth-schema] invalid (...) missing tables: ... | missing columns: ... | ...`

Operational note:
- guard logs only schema object names and DB target label, never secrets, tokens, or cookies.
