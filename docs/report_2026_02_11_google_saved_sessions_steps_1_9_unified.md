# Unified Report: Google Saved Sessions (Steps 1-9)

Date: 2026-02-11
Scope: local + account-backed saved interfaces (google identity, arnvoid backend session, postgres memory)
Status: Steps 1-9 implemented and hardened

## 1) Executive Summary

This work migrated saved interfaces from local-only behavior into a local-first plus account-backed mirror model, with strict guarantees:

1. UX truth remains local (in-memory + localStorage), always immediate.
2. Remote database sync is mirror-only and best-effort.
3. Identity isolation is enforced across guest/user and user A/user B.
4. Restore path is read-only and must not trigger save/sync side effects.
5. Ordering is stable and based on payload `updatedAt`, not DB row `updated_at`.

Main outcomes:

1. Auth schema safety gate added and stabilized.
2. `saved_interfaces` postgres table added with constraints/indexes.
3. RequireAuth backend CRUD API added for list/upsert/delete.
4. Frontend API helpers added in `src/api.ts`.
5. AppShell became sync orchestrator (local namespace + hydrate/merge + mirror).
6. Identity switch hardening added (epoch and late-response protection).
7. Write seams unified through AppShell commit contract.
8. Restore pipeline hardened as read-only.
9. Persistent per-identity remote outbox with retry/backoff added.

---

## 2) Step-by-Step Detail

## Step 1: Auth schema verification gate

Goal:
- Fail fast if auth base schema is missing (`users`, `sessions`, required columns/constraints).

Implemented:
- Startup/runtime auth schema verification.
- CLI check path for quick environment validation.

Why:
- Code assumed auth tables while migrations did not guarantee creation in all envs.
- Prevents silent runtime auth failure.

Key files:
- `src/server/src/authSchemaGuard.ts`
- `src/server/src/serverMonolith.ts`
- `src/server/package.json`

---

## Step 2: Postgres table for saved interfaces

Goal:
- Add durable account-backed storage for saved interfaces.

Implemented migration:
- `src/server/migrations/1770383000000_add_saved_interfaces.js`

Table shape:
- `id` bigserial PK
- `user_id` bigint FK -> `users(id)` ON DELETE CASCADE
- `client_interface_id` text not null
- `title` text not null
- `payload_version` integer default 1
- `payload_json` jsonb not null (full payload)
- `created_at`, `updated_at` timestamptz default now()

Constraints/indexes:
- unique `(user_id, client_interface_id)`
- index `(user_id, updated_at desc)`
- index `(user_id, title)`

Why:
- Full payload memory in backend DB, keyed by authenticated user.

---

## Step 3: Backend API (requireAuth)

Goal:
- Add secure saved-interface routes behind session auth.

Implemented routes:
- `GET /api/saved-interfaces`
- `POST /api/saved-interfaces/upsert`
- `POST /api/saved-interfaces/delete`

Rules implemented:
- requireAuth for all routes
- full payload accepted (`payloadJson`)
- payload size guard (15 MB)
- calm errors (400/401/413/500), no payload logging

Key file:
- `src/server/src/serverMonolith.ts`

---

## Step 4: Frontend API helpers

Goal:
- Provide typed client helpers for saved-interface endpoints.

Implemented:
- `listSavedInterfaces()`
- `upsertSavedInterface(...)`
- `deleteSavedInterface(...)`
- types: `SavedInterfaceApiRecord`, `SavedInterfaceUpsertInput`

Important contract:
- `dbCreatedAt`/`dbUpdatedAt` are metadata only.
- ordering truth remains payload record timestamps.

Key file:
- `src/api.ts`

---

## Step 5: AppShell sync brain (first orchestration)

Goal:
- Centralize local+remote hydration/mirror in AppShell.

Implemented:
- auth-aware local storage key namespace
- hydrate/merge flow on auth-ready
- mirror on save/rename/delete
- backfill for missing/newer local records

Store seam update:
- `src/store/savedInterfacesStore.ts`
- added active key helpers (`get/set/buildSavedInterfacesStorageKey...`)

AppShell:
- `src/screens/AppShell.tsx`

---

## Step 6: Account isolation hardening

Goal:
- Prevent guest/user and userA/userB bleed.

Implemented:
- identity key (`guest` or `user:<id>`)
- identity epoch increment on switch
- reset of pending intents and sync guards
- late async response guards by epoch/identity/storage key

Result:
- stale remote responses do not mutate new identity state.

---

## Step 7: Unified write seams

Goal:
- One coherent write contract for local state/localStorage/remote mirror.

Implemented AppShell commit surface:
- `commitUpsertInterface(...)`
- `commitPatchLayoutByDocId(...)`
- `commitRenameInterface(...)`
- `commitDeleteInterface(...)`
- `commitHydrateMerge(...)`

Rewired:
- `nodeBinding` no longer writes local storage directly.
- Graph layout patch no longer writes local storage directly.
- AppShell commits now own mutation + persist + mirror enqueue.

Key files:
- `src/screens/AppShell.tsx`
- `src/playground/GraphPhysicsPlaygroundShell.tsx`
- `src/document/nodeBinding.ts`

---

## Step 8: Preserve restore pipeline invariants

Goal:
- Restore must remain pure read path.

Implemented:
- restore-mode guard in graph shell to block write callbacks during restore
- AppShell defense-in-depth reason guards
- no remote writes during restore-active phase

Restore call path remains:
- select in sidebar -> `pendingLoadInterface` -> graph restore effect
- apply parsedDocument/topology/layout/camera/analysisMeta
- no analysis re-run from restore

Key files:
- `src/playground/GraphPhysicsPlaygroundShell.tsx`
- `src/screens/AppShell.tsx`

---

## Step 9: Remote-failure resilience (outbox)

Goal:
- Remote sync best-effort + resilient, never blocks local.

Implemented:
- persistent per-identity outbox in AppShell
- queue item model for `upsert`/`delete`
- local commit first, remote async drain later
- retry with exponential backoff + jitter
- 401 pause and resume behavior
- online trigger + timer scheduler
- identity-key isolation for outbox
- restore-active drain block

Error policy:
- retryable: network/timeout/5xx/429
- 401: pause window, keep local working
- 413/non-retryable: drop queue item, local unaffected
- payload contents never logged

Additional hardening:
- `payload_missing` classified as non-retryable to avoid infinite retry loop.

Key file:
- `src/screens/AppShell.tsx`

---

## 3) Final Architecture (After Step 9)

Data flow:

1. User action (save/layout patch/rename/delete)
2. AppShell commit function
3. Immediate in-memory update
4. Immediate localStorage persist (active identity key)
5. Remote outbox enqueue (if authenticated)
6. Async outbox drain with guards/retry

Hydration flow:

1. Load local for active identity
2. If authenticated, fetch remote list
3. Parse payloads and merge by payload `updatedAt`
4. Persist merged local
5. Enqueue backfill as needed

Restore flow:

1. AppShell sets `pendingLoadInterface`
2. Graph consumes restore once
3. Applies saved document/topology/layout/camera/analysisMeta
4. Restore mode blocks all write callbacks

---

## 4) Invariants Now Enforced

1. Local-first responsiveness:
- local update never waits for remote.

2. Full payload preservation:
- parsed text + meta/warnings + topology + layout + camera + analysisMeta are preserved in local and remote upsert payloads.

3. Ordering stability:
- list order uses payload timestamps, not DB row timestamps.
- rename does not bump `updatedAt`.
- layout patch does not bump `updatedAt` in active AppShell path.

4. Identity isolation:
- namespace key + epoch + identity guards + per-identity outbox.

5. Restore purity:
- no save/sync side effects during restore.

6. Failure containment:
- remote failures do not crash or block local UX.

---

## 5) Remaining Sharp Edges (Known, Acceptable)

1. Outbox payload duplication:
- localStorage holds saved record plus queued payload copy for unsent upserts.
- first suspect under storage pressure.

2. Persistent 401 environments:
- queue pauses and retries; if auth never recovers, mirror never drains (local still fine).

3. Manual validation still required:
- offline/recovery/auth-switch/restore scenarios should be run manually in integration environment.

---

## 6) Must-Pass Manual Validation Matrix

1. Guest offline/local:
- create/rename/delete updates instantly and survives reload.

2. Logged-in hydration:
- remote+local merge is correct on boot.

3. Identity switch:
- A/B/A switching shows isolated data and no stale apply.

4. Restore integrity:
- restore applies saved organic layout/camera and summaries.
- restore does not trigger remote writes.

5. Remote failure behavior:
- offline queue grows, recovery drains.
- 401 pause and later resume after auth recovery.

6. Build:
- root `npm run build` passes.

---

## 7) Files Most Impacted Across Steps 1-9

Backend:
- `src/server/src/authSchemaGuard.ts`
- `src/server/src/serverMonolith.ts`
- `src/server/migrations/1770383000000_add_saved_interfaces.js`
- `src/server/src/db.ts`

Frontend:
- `src/api.ts`
- `src/store/savedInterfacesStore.ts`
- `src/screens/AppShell.tsx`
- `src/playground/GraphPhysicsPlaygroundShell.tsx`
- `src/document/nodeBinding.ts`

Docs:
- `docs/report_2026_02_10_google_memory_saved_interfaces_forensic_v2.md`
- `docs/report_2026_02_11_saved_interfaces_unified_write_contract_step7.md`
- `docs/report_2026_02_11_preserve_restore_pipeline_step8.md`
- `docs/report_2026_02_11_remote_failure_saved_interfaces_step9.md`

