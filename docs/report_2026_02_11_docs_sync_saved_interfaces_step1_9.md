# Report: Docs Sync For Saved Interfaces Step 1-9

Date: 2026-02-11
Scope: docs-only sync for `docs/system.md` and `docs/repo_xray.md`

## Goal

Align central docs with saved-interfaces implementation status through step 1-9:
- local + remote account memory
- unified AppShell write seams
- restore read-only invariants
- identity isolation
- remote outbox retry behavior

## What Was Updated

## 1) docs/system.md

Updated `2.4 Persistent Sidebar Sessions (Current)` to include:
1. Search overlay behavior:
   - centered AppShell overlay
   - in-memory filter from AppShell list
   - pointer/wheel shielding contract
2. Full payload contract details for `SavedInterfaceRecordV1`:
   - full parsed text and meta/warnings
   - topology
   - layout node world coords + camera snapshot
   - analysisMeta summaries
3. Ordering truth:
   - payload `updatedAt` is canonical
   - DB `updated_at` is metadata only
4. Backend schema specifics:
   - migration filename
   - `public.saved_interfaces` shape
   - constraints and indexes
5. API payload limit:
   - `MAX_SAVED_INTERFACE_PAYLOAD_BYTES` default 15 MB
6. Outbox namespace and retry note:
   - per-identity outbox storage key
   - `payload_missing` marked non-retryable to prevent infinite retries

## 2) docs/repo_xray.md

Added and expanded saved-interfaces runtime map:
1. Update note includes non-retryable `payload_missing` guard.
2. `7.1 Saved Interfaces Sync Map` now includes:
   - restore read-only constraint
   - payload/API contract and 15 MB limit
   - search overlay contract
3. New `7.2 Saved Interfaces Call Graph (Step 7-9)`:
   - explicit single-writer write path
   - explicit read-only restore path
4. New `7.3 Saved Interfaces DB Reference`:
   - migration path
   - table name
   - FK/unique/index summary
5. Extended section 14 with:
   - search overlay mention
   - step 8 and 9 hardening mention
   - direct links to forensic reports for future dev navigation

## Why These Changes

Previous docs already had partial saved-interface updates, but key operational details were still distributed across reports and code:
1. payload and ordering contracts were not explicit enough in central docs
2. search overlay behavior was not mapped in central docs
3. DB migration and payload-limit details were missing from central quick-reference areas
4. outbox infinite retry guard (`payload_missing`) needed to be documented as current truth

## Runtime Code Changes

None. This task was docs-only by scope.

