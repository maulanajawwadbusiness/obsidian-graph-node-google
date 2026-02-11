# Report: DB Auth Schema Check and Repair Worklog (2026-02-11)

## Scope
- Topic: auth schema verification gate and live schema repair for `users` and `sessions`
- Goal: make `npm run check:auth-schema` reliable and ensure schema matches runtime auth assumptions
- Environment: local laptop + Cloud SQL connector path + local proxy path (`127.0.0.1:5432`)

## Executive Summary
- The auth schema gate is now active and working.
- Live DB schema drift was confirmed and repaired:
  - `sessions.user_id` changed from `int4` to `int8` (`bigint`)
  - FK `sessions.user_id -> users.id` was added
- `npm run check:auth-schema` previously timed out due to process/resource lifecycle in checker path.
- Timeout behavior was fixed in code by adding connection timeout and explicit pool/connector cleanup.
- Final status: schema check returns `ok` quickly and consistently in current session.

## What Was Already Implemented Before This Session

### Step 1 Gate (already in repo)
- Commit: `735037a`
- Added:
  - `src/server/src/authSchemaGuard.ts`
  - startup fail-fast hook in `src/server/src/serverMonolith.ts`
  - script `check:auth-schema` in `src/server/package.json`
- Behavior:
  - startup runs auth schema validation before listen
  - checker validates tables, columns, FK, unique expectations

## Issues Encountered During This Session

### 1) Profile/env confusion in shell context
- Symptom: `INSTANCE_CONNECTION_NAME` showed missing in some runs.
- Root cause:
  - profile execution was blocked earlier by PowerShell policy in this tool context
  - env visibility differed between interactive user shell and automation shell
- Resolution:
  - user fixed local policy/profile side
  - env became available in subsequent checks

### 2) Real schema drift in live DB
- Confirmed via direct SQL against proxy:
  - `users.id` was `bigint` (`int8`)
  - `sessions.user_id` was `integer` (`int4`) -> mismatch
  - FK from `sessions.user_id` to `users.id` was missing
- Risk:
  - mismatch can fail when user id range grows
  - missing FK allows orphan sessions and weaker integrity

### 3) Checker timeout even when schema was healthy
- Symptom:
  - `npm run check:auth-schema` timed out in this runner, even after schema became correct
- Root cause:
  - checker path used Cloud SQL connector and process could stay alive due to open resources
  - no explicit close of pool/connector in CLI path
  - no explicit connector setup timeout guard

## Live DB Repairs Performed

## A) Type repair: `sessions.user_id` to bigint
- SQL applied:
```sql
begin;
alter table public.sessions
  alter column user_id type bigint
  using user_id::bigint;
commit;
```
- Verification after apply:
  - `information_schema.columns` reports `data_type=bigint`, `udt_name=int8` for `public.sessions.user_id`

## B) FK repair: `sessions.user_id -> users.id`
- Pre-check:
  - orphan sessions count was `0`
- SQL applied:
```sql
begin;
alter table public.sessions
  add constraint sessions_user_id_fkey
  foreign key (user_id)
  references public.users(id)
  on delete cascade;
commit;
```
- Verification after apply:
  - `has_fk = true` via information schema query
  - `pg_constraint` shows `sessions_user_id_fkey` with `ON DELETE CASCADE`

## Code Hardening Done in This Session

### Files changed
- `src/server/src/db.ts`
- `src/server/src/authSchemaGuard.ts`
- `docs/report_2026_02_05_auth_session_postgres.md`

### Changes
1. Added `DB_CONNECT_TIMEOUT_MS` (default `15000`) in `src/server/src/db.ts`
2. Added timeout wrapper around Cloud SQL connector setup in `src/server/src/db.ts`
3. Added `connectionTimeoutMillis` on pg pool in `src/server/src/db.ts`
4. Added `closePool()` to close both pg pool and connector in `src/server/src/db.ts`
5. Updated CLI checker in `src/server/src/authSchemaGuard.ts` to always call `closePool()` in `finally`
6. Added auth report note documenting timeout hardening and operational behavior

### Commit
- Commit: `852478d`
- Message: `server: harden auth schema check timeout and cleanup`
- Files in commit:
  - `src/server/src/db.ts`
  - `src/server/src/authSchemaGuard.ts`
  - `docs/report_2026_02_05_auth_session_postgres.md`

## Verification Results

### Build
- `src/server`: `npm run build` passed

### Auth schema check
- `npm run check:auth-schema` now returns:
```text
[auth-schema] ok db=arnvoid-project:asia-southeast2:arnvoid-postgres/arnvoid tables=sessions,users fk_sessions_user=true uq_users_google_sub=true uq_sessions_id=true
```

### Direct DB checks (proxy path)
- `npm run db:ping` passed
- SQL checks confirm:
  - `public.sessions.user_id` is `bigint`
  - FK exists from `public.sessions.user_id` to `public.users.id`

## Why Timeout Happened Previously
- Schema check path uses Cloud SQL connector path from `src/server/src/db.ts`.
- In some runs, process did not exit quickly due to open connector/pool lifecycle and no forced cleanup.
- This was not a data corruption issue.
- This did not indicate broken schema once SQL verification passed.

## Current Status
- Auth schema gate: active
- Live auth schema alignment: correct for required checks
- CLI check reliability: fixed in current code

## Remaining Follow-ups (Recommended)
1. Add a tracked migration for `sessions.user_id bigint` and FK addition for reproducibility across environments.
2. Add a one-time schema baseline migration for `users` and `sessions` if not already tracked to reduce drift risk.
3. Keep `check:auth-schema` in pre-deploy checklist for backend release.

## Safety Notes
- No tokens, cookies, or secrets are recorded in this report.
- DB password values are not copied here.
- Only schema object names and status were logged.
