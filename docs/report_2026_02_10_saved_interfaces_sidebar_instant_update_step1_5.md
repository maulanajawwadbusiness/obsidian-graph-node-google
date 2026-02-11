# Report: Saved Interfaces Sidebar Instant Update (Step 1-5)

Date: 2026-02-10
Scope: LocalStorage-only, no backend or UI redesign

## Summary
This report consolidates Step 1 through Step 5 for the sidebar instant-update bug: saved interfaces were written correctly but did not appear in `Your Interfaces` until reload. The work established root cause, added a same-tab refresh bridge, hardened duplicate-notify behavior for StrictMode, and completed plumbing verification without adding any new UI surfaces.

## Step 1: Forensic Root Cause
- Confirmed save happens during analysis success in `src/document/nodeBinding.ts` via `upsertSavedInterface(...)`.
- Confirmed post-save layout patch happens in `src/playground/GraphPhysicsPlayground.tsx` via `patchSavedInterfaceLayout(...)`.
- Confirmed AppShell list state was only refreshed on mount and graph-screen transitions in `src/screens/AppShell.tsx`, not at save time.
- Root cause: no runtime bridge from graph save success to AppShell refresh in same tab.
- Forensic source: `docs/report_2026_02_10_saved_interfaces_sidebar_not_updating_forensic.md`.

## Step 2: Implement Option A Bridge
- Added callback plumbing from AppShell to graph:
  - AppShell passes `onInterfaceSaved` prop to graph.
  - Graph calls callback only after successful analysis completion and layout patch.
- Behavior: newly saved interface appears immediately in sidebar without reload.
- No store ordering or dedupe behavior changed.

## Step 3: Harden StrictMode/Double-Fire Guard
- Strengthened notify guard in graph from docId-only to `docId + runToken` key.
- Kept notify call strictly in success path, after save + layout patch.
- Added skip log for guarded duplicates:
  - `[graph] interface_saved_notify_skipped docId=... reason=already_notified`
- Maintained success log:
  - `[graph] interface_saved_notify docId=...`

## Step 4: Preserve Ordering and No Client Merge
- Kept AppShell refresh behavior as reload-from-store only (`loadSavedInterfaces()`).
- No append/merge/sort logic added in AppShell or Sidebar.
- Store remains source of truth for newest-first ordering.

## Step 5: Closing Plumbing Verification
- Verified graph notify is not fired from restore flow.
- Verified callback is wired consistently as optional prop and used safely.
- Stabilized AppShell callback identity with `useCallback` to avoid unnecessary prop churn.
- Confirmed no new UI components, toasts, panels, or visual states were introduced.
- Build verification passed (`npm run build`).

## Commits in This Track
- `d897e0f` - `Fix: harden sidebar saved interfaces instant update guard`
- `5a8124b` - `Chore: verify saved interfaces instant update plumbing (no UI)`

## Affected Files (Step 1-5 Track)
- `src/playground/GraphPhysicsPlayground.tsx`
- `src/screens/AppShell.tsx`
- `docs/report_2026_02_10_saved_interfaces_sidebar_not_updating_forensic.md`
- `docs/report_2026_02_10_saved_interfaces_sidebar_instant_update_step1_5.md` (this report)
