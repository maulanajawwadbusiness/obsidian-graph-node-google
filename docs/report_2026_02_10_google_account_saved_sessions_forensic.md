# Report 2026-02-10: Google Account Memory for Saved Sessions (Forensic Scan)

## 1. Scope and Goal

Goal:
- Move saved sessions from device-only localStorage to account-backed memory so the same user can recover sessions after browser reset or on another device.

Important clarification:
- In this codebase, "Google memory" currently means Google sign-in identity + Arnvoid backend session cookie + Postgres user row.
- There is no Google Drive API integration today.
- Practical target is: store saved sessions in Arnvoid backend DB, keyed by authenticated user.

Out of scope for this report:
- No implementation.
- No schema mutation.
- No API addition.

---

## 2. Executive Verdict

Feasible: Yes.

Best architecture for this repo:
- Keep localStorage as fast local cache and offline fallback.
- Add authenticated backend CRUD endpoints for saved sessions.
- Use AppShell as sync orchestrator (not Sidebar and not GraphPhysicsPlayground).
- Keep Graph restore path unchanged (still consumes `pendingLoadInterface` object).

Why:
- Current auth/session backend is already production-grade enough for user-owned data boundaries.
- Saved session payload shape already exists and is validated in one place (`savedInterfacesStore`).
- Minimal behavior risk if we preserve the existing AppShell -> Graph selection contract.

---

## 3. Current System Truth (What Exists Today)

### 3.1 Saved sessions are local-only

Store module:
- `src/store/savedInterfacesStore.ts:4` uses key `arnvoid_saved_interfaces_v1`.
- Reads local: `src/store/savedInterfacesStore.ts:245`.
- Writes local: `src/store/savedInterfacesStore.ts:269`.
- Upsert/dedupe/cap logic: `src/store/savedInterfacesStore.ts:281`.
- Rename patch: `src/store/savedInterfacesStore.ts:352`.
- Layout patch: `src/store/savedInterfacesStore.ts:327`.

Save trigger:
- Analysis success path writes saved session in `src/document/nodeBinding.ts:214`.
- Dedupe key uses docId + title + topology hash in `src/store/savedInterfacesStore.ts:232`.

Load trigger:
- AppShell reads local sessions into state (`savedInterfaces`) via `loadSavedInterfaces()` in `src/screens/AppShell.tsx:156`.
- Selection sets `pendingLoadInterface` in `src/screens/AppShell.tsx:170`.
- Graph consumes restore intent in `src/playground/GraphPhysicsPlayground.tsx:798`.

### 3.2 Google auth memory exists, but only for identity/session

Frontend auth source of truth:
- `AuthProvider` bootstraps from `/me`: `src/auth/AuthProvider.tsx:50`.
- `/me` is polled on focus refresh: `src/auth/AuthProvider.tsx:130`.
- All auth/backend calls use `credentials: "include"`: `src/api.ts:40`, `src/components/GoogleLoginButton.tsx:76`.

Backend auth/session:
- Google token verification and user upsert: `src/server/src/index.ts:510`.
- Session row insert: `src/server/src/index.ts:590`.
- Cookie set (`arnvoid_session`): `src/server/src/index.ts:601`.
- `/me` session read/join users: `src/server/src/index.ts:620`.
- Auth middleware (`requireAuth`) for API routes: `src/server/src/index.ts:357`.

Conclusion:
- Identity memory exists (users/sessions).
- Saved-session memory does not exist server-side yet.

---

## 4. What Must Be Added (What)

Minimum backend capability:
1. List saved sessions for current authenticated user.
2. Upsert a saved session for current authenticated user.
3. Delete saved session for current authenticated user.
4. Optional patch endpoints for rename/layout to avoid full-payload rewrite each time.

Minimum frontend capability:
1. Hydrate AppShell saved list from backend after auth is known.
2. Keep local cache in sync for instant UI and offline fallback.
3. Sync writes on save/rename/delete/layout updates.
4. Resolve conflicts deterministically.

Data boundary:
- Ownership enforced by `requireAuth` and `user_id` FK.
- No client-provided user id trust.

---

## 5. Where Changes Belong (Where)

### Frontend

Primary seam:
- `src/screens/AppShell.tsx`
  - already owns saved list and user interactions (`refreshSavedInterfaces`, rename/delete/select).
  - best place to coordinate local cache + remote sync lifecycle.

Supporting seams:
- `src/document/nodeBinding.ts`
  - currently writes local directly.
  - likely needs callback/event to AppShell sync pipeline (or temporary "write local then enqueue remote").
- `src/playground/GraphPhysicsPlayground.tsx`
  - currently patches local layout via `patchSavedInterfaceLayout` in `src/playground/GraphPhysicsPlayground.tsx:653`.
  - this write path must be rerouted or mirrored to backend to avoid stale remote layout.

API client:
- `src/api.ts`
  - add typed helpers for new saved-session endpoints.

### Backend

HTTP routes:
- `src/server/src/index.ts`
  - add routes under `/api/...` with `requireAuth`.

DB:
- `src/server/migrations/*`
  - add migration for saved-session tables.
  - run from `src/server` per `docs/db.md:23`.

---

## 6. When Sync Should Happen (When)

Recommended sync moments:
1. App boot after auth resolves:
   - If logged in, fetch remote list once and merge to local cache.
2. On successful analysis save:
   - local upsert immediately for UX.
   - async remote upsert.
3. On rename/delete:
   - local update first for responsiveness.
   - async remote mutation.
4. On layout patch:
   - throttle/debounce remote writes (layout can be noisy).
5. On logout:
   - do not delete local cache automatically unless explicit product decision.
6. On login switch (different account):
   - isolate/namespace local cache per account or perform clear+rehydrate to avoid cross-account bleed.

---

## 7. How It Should Work (How)

## 7.1 Storage model recommendation

Option A (recommended for speed and low diff):
- Single table `saved_interfaces` with `payload_json` (jsonb) and searchable metadata columns.

Suggested columns:
- `id uuid pk`
- `user_id bigint not null references users(id) on delete cascade`
- `client_interface_id text not null` (existing local `id`, for idempotent upsert from client)
- `doc_id text not null`
- `title text not null`
- `updated_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`
- `payload_json jsonb not null` (full `SavedInterfaceRecordV1`)
- `dedupe_key text not null`
- unique (`user_id`, `client_interface_id`)
- indexes on (`user_id`, `updated_at desc`) and (`user_id`, `doc_id`)

Why this shape:
- Preserves existing payload contract with minimal transform risk.
- Keeps server ownership boundaries simple.
- Enables future partial extraction later.

## 7.2 API contract recommendation

Endpoints (auth required):
- `GET /api/saved-interfaces`
- `POST /api/saved-interfaces/upsert`
- `POST /api/saved-interfaces/delete`
- Optional:
  - `POST /api/saved-interfaces/patch-title`
  - `POST /api/saved-interfaces/patch-layout`

Validation:
- Reuse or port sanitization logic from `savedInterfacesStore` (shape checks).
- Enforce max list size server-side too.
- Reject payloads above size threshold (protect DB and latency).

## 7.3 Frontend sync strategy recommendation

Read path:
- Keep in-memory state in AppShell as source for UI render performance.
- On auth-ready:
  - fetch remote list
  - sanitize
  - merge with local list by `(dedupeKey, updatedAt)` rule
  - write merged result to local cache and AppShell state.

Write path:
- Local-first optimistic update for immediate UI.
- Fire remote mutation; if failure, keep local and surface non-blocking sync warning.

Conflict rule:
- Last write wins by `updatedAt`.
- If equal timestamp, prefer remote to reduce split-brain across devices.

---

## 8. Why This Is Needed (Why)

Current pain:
- localStorage survives only same browser profile/device.
- user loses saved sessions on cache clear/reinstall/new machine.

Business and UX value:
- account continuity after login.
- cross-device restore.
- better trust in "saved sessions" promise.

Engineering reason:
- auth/session infrastructure already exists and is the right trust boundary.

---

## 9. Actor Map (Who)

User:
- Signs in with Google, expects saved sessions to follow account.

Frontend owner components:
- `AuthProvider` for auth truth.
- `AppShell` for saved list and selection intent.
- `Sidebar` for UI actions only.
- `GraphPhysicsPlayground` for restore and layout capture.

Backend owner:
- `requireAuth` middleware and Postgres persistence in `src/server/src/index.ts`.

Database owner:
- migrations under `src/server/migrations`.

---

## 10. Conflicts and Risks (Code Conflict / Code Issue)

1. No backend saved-session endpoints exist yet
- Evidence: no matching routes in `src/server/src/index.ts` (only auth, payments, llm, balance).

2. Local writes happen from multiple places
- Save: `src/document/nodeBinding.ts:214`.
- Layout patch: `src/playground/GraphPhysicsPlayground.tsx:653`.
- Rename/delete: `src/screens/AppShell.tsx:511`, `src/screens/AppShell.tsx:201`.
- Risk: partial migration can desync local/remote if one seam is missed.

3. AppShell currently not auth-aware for saved list decisions
- `src/screens/AppShell.tsx` does not consume `useAuth()`.
- Risk: cannot cleanly switch between anonymous local-only mode and account mode without adding auth-aware branching.

4. Users/sessions schema is not represented in tracked migrations
- `src/server/migrations/1770332268745_init-tables.js` is empty.
- Yet runtime code relies on `users` and `sessions` in `src/server/src/index.ts:575` and `src/server/src/index.ts:590`.
- Risk: environment drift and onboarding friction for new environments.

5. Payload size and sensitivity
- Saved payload includes `parsedDocument.text` (`src/store/savedInterfacesStore.ts:128` validation path).
- Risk: large DB writes, sensitive text retention obligations.

6. ID strategy mismatch risk
- Local IDs are generated client-side (`iface-${Date.now()}-${documentId}`) at `src/document/nodeBinding.ts:215`.
- Needs server idempotency key (`client_interface_id`) to avoid duplicates across retries/devices.

7. Restore behavior regression risk
- Restore pipeline is strict and stateful with guards (`hasConsumedLoadRef`, `isRestoringRef`) in `src/playground/GraphPhysicsPlayground.tsx:798`.
- Any change to pending-load object timing can regress prompt->graph restore.

8. Auth UX mode currently permissive
- EnterPrompt login overlay is disabled (`src/screens/EnterPrompt.tsx:10`).
- Users can operate without login; product decision needed for anonymous local sessions + account sessions coexistence.

---

## 11. Recommended Rollout Plan (No Code, Decision Complete)

Phase 1: Backend foundation
1. Add migration for `saved_interfaces` table and indexes.
2. Add authenticated CRUD endpoints in `src/server/src/index.ts`.
3. Add payload validation and max payload size limits.

Phase 2: Frontend read path
1. Add API client helpers in `src/api.ts`.
2. Make AppShell auth-aware (`useAuth`) and hydrate from remote when logged in.
3. Merge remote + local with deterministic policy.

Phase 3: Frontend write path
1. Route save/rename/delete/layout updates through AppShell sync service.
2. Keep local optimistic updates.
3. Add remote sync retry/backoff and lightweight dev logs.

Phase 4: Hardening
1. Add telemetry logs for sync failures and conflict resolutions.
2. Add manual test checklist (login, save, reload, cross-device, logout, re-login).
3. Document policy in `docs/system.md` and `docs/repo_xray.md`.

---

## 12. Open Decisions You Must Lock Before Implementation

1. Anonymous mode policy:
- Keep local sessions when logged out, or hide them behind login-only mode?

2. Conflict policy:
- strict last-write-wins by `updatedAt`, or prompt user on conflict?

3. Data retention:
- store full `parsedDocument.text` server-side, or redact/summarize for privacy and size?

4. Session cap:
- keep current cap 20 globally or make per-user configurable?

5. Layout patch frequency:
- immediate each capture, or throttled commit intervals?

---

## 13. Final Forensic Conclusion

The system already has robust Google account identity memory (users + sessions + cookie auth), but saved sessions are still device-local.

The clean path is not Google Drive integration. It is:
- authenticated Arnvoid backend persistence keyed by `users.id`,
- AppShell-owned sync orchestration,
- local cache retained for speed/offline,
- Graph restore contract unchanged.

This can be implemented with moderate risk if all three write seams are unified:
- analysis save,
- rename/delete,
- layout patch.

No implementation was performed in this report task.

