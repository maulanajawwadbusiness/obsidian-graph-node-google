# Report: Saved Interfaces Sync Brain (Step 5) + Ordering Hardening

Date: 2026-02-11
Scope: AppShell orchestration for local + account-backed saved interfaces sync, plus ordering safety hardening.

## 1) Goal
Make `AppShell` the sync orchestrator for saved interfaces so the app:
- remains fully usable offline and logged-out (localStorage path),
- mirrors saved interfaces to backend when authenticated,
- prevents cross-account local cache bleed,
- preserves full payload JSON (no trimming),
- avoids reorder regressions from backend row timestamps.

## 2) Files Changed
- `src/store/savedInterfacesStore.ts`
- `src/screens/AppShell.tsx`
- `src/api.ts` (ordering hardening follow-up)
- `docs/report_2026_02_10_google_memory_saved_interfaces_forensic_v2.md`

## 3) Store Seam Added (Namespace Support)
In `src/store/savedInterfacesStore.ts`:
- Added active key state:
  - `activeSavedInterfacesKey` (defaults to `SAVED_INTERFACES_KEY`)
- Added helpers:
  - `getSavedInterfacesStorageKey()`
  - `setSavedInterfacesStorageKey(nextKey)`
  - `buildSavedInterfacesStorageKeyForUser(userId)`
  - `parseSavedInterfaceRecord(value)` (exported validator wrapper)
- Updated local read/write to use active key:
  - `loadSavedInterfaces()`
  - `saveAllSavedInterfaces()`

Why:
- existing write seams in node binding and graph layout patch now automatically target the active namespace without callsite rewrites.

## 4) AppShell Sync Brain Behavior
In `src/screens/AppShell.tsx`:

### A) Auth-aware key switching
- Reads auth from `useAuth()`:
  - `user`
  - `loading`
- Derives stable namespace id from `user.id` (fallback `user.sub`).
- Switches key:
  - logged out: default `arnvoid_saved_interfaces_v1`
  - logged in: `arnvoid_saved_interfaces_v1_user_<id-or-sub>`
- On key switch:
  - refreshes local list,
  - resets sync refs,
  - clears pending restore intent to avoid cross-key stale selection.

### B) Initial hydration and merge
- Logged-in hydration flow:
  1. load local records from active key
  2. `listSavedInterfaces()` remote fetch
  3. parse remote `payloadJson` with `parseSavedInterfaceRecord`
  4. merge by record id, last-write-wins by payload `record.updatedAt`
  5. tie handling: remote wins (`>=`)
  6. persist merged result into active local key
  7. update AppShell state
- Invalid remote payloads are skipped safely with id-only logs.

### C) Remote mirroring triggers
- Added remote operations:
  - `remoteUpsertRecord(record, reason)`
  - `remoteDeleteById(id, reason)`
- Trigger points:
  - analysis save callback (`handleInterfaceSaved`)
  - sidebar rename (`handleRenameInterface`)
  - delete confirm (`confirmDelete`)
- Logged-out mode:
  - remote sync disabled, local behavior continues.
- Failure mode:
  - local remains authoritative, calm warning log only.

### D) Backfill
- One-time per storage key login backfill:
  - queues upsert for records missing remotely or newer than remote
  - capped by `REMOTE_BACKFILL_LIMIT = 10`
  - serialized by queue.

## 5) StrictMode Safety
Implemented duplicate-work guards in AppShell:
- `hydratedStorageKeysSession` set (one hydration per key per session)
- `backfilledStorageKeysSession` set (one backfill per key per session)
- `lastSyncedStampByIdRef` (no duplicate upsert for same stamp)
- `remoteSyncChainRef` (serialized remote writes)

This avoids duplicate sync calls during React StrictMode remount/effect replay.

## 6) Ordering Risk and Hardening

Risk:
- backend upsert updates DB row `updated_at = now()`.
- if frontend merge/sort uses DB row timestamp, rename/upsert can silently reorder on reload.

Hardening applied:
1. In `src/api.ts`, renamed DB timestamps in helper record:
   - `createdAt` -> `dbCreatedAt`
   - `updatedAt` -> `dbUpdatedAt`
   This makes them explicit row metadata, not ordering truth.

2. In `src/screens/AppShell.tsx`, merge path explicitly uses parsed payload:
   - `parseSavedInterfaceRecord(item.payloadJson)` -> `remoteRecord.updatedAt`
   - sort and merge compare payload `updatedAt`.

3. Added DEV divergence log when DB row timestamp and payload timestamp differ:
   - log key: `[savedInterfaces] db_ts_diverges_ignored ...`
   - behavior: informational only, DB timestamp is ignored for ordering.

Result:
- ordering truth remains payload record timestamp.
- rename local behavior remains non-reordering.

## 7) Payload Contract
Remote upsert sends full record object in `payloadJson`:
- `parsedDocument.text`
- `parsedDocument.meta`
- `parsedDocument.warnings`
- `topology`
- `layout`
- `camera`
- `analysisMeta`
- all other record fields

No summarization/stripping introduced.

## 8) Validation Run
Command:
- `npm run build` (repo root)

Result:
- passed
- only existing non-blocking Vite warnings remained (chunk size/fonts/use client warning).

## 9) Commits Produced
- `efd7902` - `sync: appshell orchestrates saved interfaces (local + remote)`
- (ordering hardening currently applied in workspace after this commit; include in next scoped commit if requested)

## 10) Operational Notes
- Offline-first behavior is preserved.
- No new UI panels or toasts were added.
- Pointer/wheel shielding paths were not altered in this step.
- Existing dedupe and list order semantics remain anchored to store/payload `updatedAt`.
