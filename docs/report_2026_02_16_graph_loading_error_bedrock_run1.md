# Graph Loading Error Bedrock Run 1 (2026-02-16)

## Scope
- Extract graph-loading gate transition logic into a pure helper seam.
- Keep runtime behavior parity for non-error paths.
- Do not change loading/error semantics yet.

## Files
- `src/screens/appshell/render/graphLoadingGateMachine.ts` (new)
- `src/screens/AppShell.tsx`

## What Changed
1. Added gate machine seam with typed contracts:
   - `GatePhase`
   - `GateEntryIntent`
   - `RuntimeStatusSnapshot`
2. Added pure helpers:
   - `getGateEntryIntent(...)`
   - `computeGraphLoadingGateBase(...)`
   - `computeGraphLoadingWatchdogPhase(...)`
3. Rewired AppShell gate effects to call pure helpers instead of inline branching.

## Behavior Parity
- Non-error flow remains unchanged:
  - `graph_loading` enters `arming`
  - loading true drives `loading`
  - seen true then loading false drives `done`
  - no-work intent (`none`) still allows `done`
  - watchdog still drives `stalled` when loading never starts

## Why This Matters
- Establishes a testable, deterministic state seam before changing contracts.
- Reduces risk for upcoming loading-vs-error decoupling work.
