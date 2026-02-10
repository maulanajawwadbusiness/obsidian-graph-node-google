# Forensic Report: Sidebar Saved Interfaces Not Updating Immediately

Date: 2026-02-10
Mode: Forensic only (no implementation)

## Root Cause Summary
Saved interface writes are happening in the same tab/session, but AppShell sidebar state is not subscribed to those writes. AppShell only refreshes `savedInterfaces` on mount and when `screen` transitions to `'graph'`, so a save that occurs while already on the graph screen does not trigger a state refresh. Result: new entries appear only after full reload (or re-entering graph), even though localStorage has already been updated.

## 1) Save Really Happens at Runtime

### A) Upsert save trigger (analysis success path)
- `applyAnalysisToNodes(...)` upserts saved interface in success path:
  - `upsertSavedInterface(...)` call: `src/document/nodeBinding.ts:194-207`
  - success log (dev): `[savedInterfaces] upsert ok ...`: `src/document/nodeBinding.ts:209-212`

### B) Layout patch save trigger (post-analysis in graph)
- `captureAndPatchSavedLayout(docId)` in graph patches same record after analysis success:
  - patch call: `patchSavedInterfaceLayout(...)`: `src/playground/GraphPhysicsPlayground.tsx:618`
  - success log (dev): `[savedInterfaces] layout_patch ...`: `src/playground/GraphPhysicsPlayground.tsx:621-627`
  - called after successful analysis await in both text/file flows:
    - text path: `src/playground/GraphPhysicsPlayground.tsx:863-873`
    - file path: `src/playground/GraphPhysicsPlayground.tsx:931-942`

Conclusion:
- Save + patch writes do happen during the same runtime session.

## 2) How Sidebar Gets Data and Why It Stales

### AppShell data ownership
- `savedInterfaces` state in AppShell: `src/screens/AppShell.tsx:66`
- mapped into Sidebar props: `src/screens/AppShell.tsx:119-130`, used at `src/screens/AppShell.tsx:275`

### Refresh points currently present
- initial mount refresh: `src/screens/AppShell.tsx:110-112`
- refresh when `screen === 'graph'`: `src/screens/AppShell.tsx:114-117`

### Missing refresh at save moment
- No callback/event from graph or store to AppShell after save/patch.
- No listener in AppShell for localStorage change events or custom events.
- Therefore, while already on graph screen, save writes do not trigger `setSavedInterfaces(...)`.

## 3) Exact Missing Trigger/Bridge

Missing link:
- save occurs in `nodeBinding` + `GraphPhysicsPlayground`, but AppShell has no immediate notification to run `refreshSavedInterfaces()`.

Evidence:
- Graph receives only these AppShell callbacks now:
  - `onPendingAnalysisConsumed`, `onPendingLoadInterfaceConsumed`: `src/screens/AppShell.tsx:223-230`
- There is no `onInterfaceSaved` / `onSavedInterfacesChanged` callback prop.

## 4) Minimal Fix Options (Ranked)

### Option A (Recommended): AppShell callback bridge
- Add `onInterfaceSaved()` callback prop from AppShell -> Graph.
- In Graph, call it once after successful save sequence (after `captureAndPatchSavedLayout` success path).
- AppShell callback runs `refreshSavedInterfaces()`.

Why recommended:
- Least diff with clear ownership.
- Same-tab reliable, no global event bus needed.
- Easy to guard once-per-analysis success (already one-shot flow).

### Option B: Store event bus
- In store write functions (`upsertSavedInterface`, `patchSavedInterfaceLayout`, `delete`), dispatch custom event:
  - `window.dispatchEvent(new CustomEvent('savedInterfaces:changed'))`
- AppShell listens and refreshes.

Pros:
- Decouples callers from AppShell.
Cons:
- Broader cross-cutting change; touches store behavior globally.

### Option C: Polling (Not recommended)
- Periodically refresh AppShell list.
- Rejected due to unnecessary churn and weaker correctness semantics.

## 5) Edge Cases to Preserve

- No refresh spam:
  - trigger refresh once per successful analysis pipeline completion.
- StrictMode double-run:
  - respect existing one-shot guards in Graph success flow.
- Newest-first order:
  - keep using store’s existing sorted load path.
- No knowledge trimming:
  - unchanged; full `parsedDocument` payload remains.

## Recommended Minimal Fix Path

Choose Option A:
1. Add `onInterfaceSaved?: () => void` from AppShell to Graph prop contract.
2. AppShell implementation calls `refreshSavedInterfaces()`.
3. In Graph, call `onInterfaceSaved?.()` only after successful analysis save + layout patch path.
4. Keep one-shot guards so callback fires once per successful analysis result.

This gives instant sidebar visibility without reload and minimal risk.

## Manual Validation Checklist (Once Fixed)

1. Start at graph screen, create a new map via analysis.
2. Verify save logs appear (`upsert ok`, `layout_patch`).
3. Verify new interface appears in Sidebar immediately (no reload, no screen transition).
4. Repeat once; ensure only one sidebar refresh/update per success.
5. Verify list order remains newest-first.
6. Verify restore still works and full parsed document data remains intact.

## Fix Implemented (Option A)

Implemented files:
- `src/screens/AppShell.tsx`
- `src/playground/GraphPhysicsPlayground.tsx`

Bridge added:
- AppShell now passes callback into graph:
  - `onInterfaceSaved={() => refreshSavedInterfaces()}`
- This refreshes `savedInterfaces` state immediately after a successful save sequence.

Graph trigger point:
- New optional graph prop: `onInterfaceSaved?: () => void`
- Notify is triggered only on analysis success path and only after save work is complete:
  1. `await applyAnalysisToNodes(...)` succeeds
  2. `captureAndPatchSavedLayout(docId)` runs
  3. `notifyInterfaceSaved(docId)` calls `onInterfaceSaved?.()`
- No notify calls in catch/error paths.

One-shot guard:
- `lastInterfaceSavedNotifiedDocIdRef` prevents duplicate notify for the same `docId` (StrictMode-safe intent).
- Dev log added when fired:
  - `[graph] interface_saved_notify docId=...`

## Hardening Implemented

Implemented files:
- `src/playground/GraphPhysicsPlayground.tsx`
- `src/screens/AppShell.tsx` (no behavioral expansion; callback path kept unchanged)

What changed:
- Strengthened notify guard from docId-only to `docId + runToken` key:
  - `notifyKey = `${docId}::${runToken}``
- Run token source is the analysis payload `createdAt` for both text and file flows.
- Notify remains success-only and ordered:
  1. `await applyAnalysisToNodes(...)` succeeds
  2. `captureAndPatchSavedLayout(docId)` runs
  3. `notifyInterfaceSaved(docId, runToken)` runs
- Added calm skip log when duplicate notify is blocked:
  - `[graph] interface_saved_notify_skipped docId=... reason=already_notified`

Ordering/dedupe behavior remains unchanged:
- AppShell still refreshes by reloading from store (`loadSavedInterfaces()`), with no append/merge logic.
- AppShell/Sidebar still do not apply local sort; store order remains source of truth (newest-first).
