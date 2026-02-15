# Prompt Bypass and Gate Latch Fix (2026-02-15)

## Scope
- Fixed prompt-origin forward bypass to graph.
- Hardened graph_loading gate latch to prevent early confirm flash.
- Did not touch legacy LoadingScreen suppression (step 7 deferred).
- Did not change analysis pipeline internals or gate visuals.

## Files Touched
- `src/screens/AppShell.tsx`
- `src/screens/appshell/screenFlow/screenFlowController.ts`

## Bypass Fix
Issue:
- Prompt restore/select path could transition directly to `graph`.

Fix:
- `selectSavedInterfaceById` now routes via prompt forward spine.
- Added `transitionWithPromptGraphGuard` in AppShell:
  - if current screen is `prompt` and target is `graph`, reroute to `graph_loading`.
  - DEV log: `[FlowGuard] blocked prompt->graph direct transition; rerouting to graph_loading`.
- Added central flow contract constant:
  - `PROMPT_FORWARD_GRAPH_CLASS_TARGET` in `screenFlowController.ts`.
  - `NEXT_SCREEN_BY_ID.prompt` now uses this constant.

## Gate Latch Hardening
Issue:
- Gate fallback could unlock `done` too early before loading signal lifecycle was observed for real work.

Fix:
- Added entry intent snapshot on entering `graph_loading`:
  - `analysis` when `pendingAnalysis` exists
  - `restore` when `pendingLoadInterface` exists
  - `none` otherwise
- No-work fallback to `done` is now allowed only when `entryIntent === 'none'`.
- For `analysis` and `restore`, gate requires loading lifecycle (`graphIsLoading` true then false) before `done`.
- Added watchdog:
  - if `entryIntent !== 'none'` and loading true is never observed within 2000ms,
  - phase moves to `stalled` (escape remains available via Back/Escape).

## Signals and Invariants
- `graphIsLoading` callback path remains unchanged.
- Warm-mount runtime topology unchanged.
- Confirm visibility rule remains strict: only when phase is `done`.

## Build Verification
- `npm run build` passed after each run.

## Manual Verification Checklist
- Prompt submit -> `graph_loading`.
- Prompt skip -> `graph_loading`.
- Prompt saved interface select -> `graph_loading`.
- Confirm does not flash early when analysis or restore work is queued.
- With `?debugWarmMount=1`, graph runtime mount id remains stable when toggling `graph_loading` <-> `graph`.
