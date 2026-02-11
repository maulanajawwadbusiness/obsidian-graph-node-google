# Preserve Restore Pipeline Invariants (Step 8)

Date: 2026-02-11

## Goal

Guarantee restore is a read-only path and never triggers save/sync side effects.

## Restore Call Graph (Current)

1. AppShell selection and navigation
- `src/screens/AppShell.tsx:401` `selectSavedInterfaceById(id)`
- sets `pendingLoadInterface` and navigates to graph when needed.

2. Graph receives restore intent
- prop wiring in `src/screens/AppShell.tsx:820`
- consumed in restore effect `src/playground/GraphPhysicsPlaygroundShell.tsx:788`

3. Restore effect read path
- restore locks set: `hasConsumedLoadRef`, `isRestoringRef`, `isRestoreReadPathRef`
- consumes pending load: `src/playground/GraphPhysicsPlaygroundShell.tsx:799`
- applies saved state:
  - `documentContext.setDocument(rec.parsedDocument)`
  - `setTopology(rec.topology, ...)`
  - layout/camera snapshot apply (if present)
  - engine rewire/reset lifecycle
- clears restore lock in `finally`.

4. Spawn/re-layout lock behavior
- default spawn skipped while restore is pending.
- fallback spawn only on restore failure with empty engine.

## Side-Effect Hazards Scanned

1. Analysis path emits save callbacks.
2. Layout patch callback called after analysis completion.
3. AppShell commit callbacks can write local and remote.
4. If any callback is accidentally fired during restore in future refactors, restore purity could be violated.

## Hardening Implemented

### 1) Graph restore-mode callback guard

File: `src/playground/GraphPhysicsPlaygroundShell.tsx`

- Added `isRestoreReadPathRef`.
- Set `isRestoreReadPathRef.current = true` at restore entry.
- Reset to false in restore `finally`.
- Guarded callback side effects during restore:
  - layout patch callback: blocked with DEV log
  - analysis upsert callback wrapper: blocked with DEV log

New DEV logs:
- `[graph] restore_write_blocked callback=layout reason=read_path`
- `[graph] restore_write_blocked callback=upsert reason=read_path`

### 2) AppShell defense-in-depth reason guard

File: `src/screens/AppShell.tsx`

- `commitUpsertInterface(...)` no-ops when reason starts with `restore_`.
- `commitPatchLayoutByDocId(...)` no-ops when reason starts with `restore_`.
- Added DEV logs for blocked restore writes.

This is a future-proof guard even though current restore path does not pass restore reason callbacks.

## Ordering Invariant

Unchanged:
- hydrate merge uses payload timestamp `record.updatedAt`.
- DB row `updated_at` remains non-authoritative for ordering.

## Done-Test Checklist (Manual)

1. Prompt -> graph restore
- expected: exact map restored, saved layout and camera applied, no analysis rerun.

2. Graph A/B/A restore switching
- expected: no relayout jump, no spawn fallback unless restore fails.

3. Logged-in and guest restore
- expected: no cross-account bleed and no stale identity apply.

4. Restore side-effect purity
- expected: no remote upsert/delete triggered by restore action.

5. Build
- expected: `npm run build` passes.
