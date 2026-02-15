# Graph Loading Gate State Machine (2026-02-15)

## Scope
- Added gate phase state machine for `screen === 'graph_loading'`.
- Wired Confirm unlock to transition into `graph` only when loading is truly done.
- Kept graph runtime warm-mount path unchanged.
- No changes to analysis trigger internals.

## Files Touched
- `src/screens/AppShell.tsx`
- `src/screens/appshell/render/renderScreenContent.tsx`
- `src/screens/appshell/render/GraphLoadingGate.tsx`

## Phase Model
- `GatePhase = 'idle' | 'arming' | 'loading' | 'done' | 'confirmed'`

Rules in AppShell:
1. Enter `graph_loading`:
   - phase -> `arming`
   - `seenLoadingTrue` -> `false`
2. In `graph_loading`, if `graphIsLoading` becomes `true`:
   - `seenLoadingTrue` -> `true`
   - phase -> `loading`
3. In `graph_loading`, if `seenLoadingTrue` is `true` and `graphIsLoading` becomes `false`:
   - phase -> `done`
4. No-work fallback:
   - if `pendingAnalysis === null`, `pendingLoadInterface === null`, and `graphIsLoading === false` while arming/loading path never started,
   - phase -> `done`
5. Confirm click from `done`:
   - phase -> `confirmed`
   - screen transition -> `graph`

## Latch Logic (No Early Confirm)
Confirm visibility/enabled state is driven only by `phase === 'done'`.
This prevents showing Confirm before one of these is true:
- real loading cycle seen (`true -> false`), or
- explicit no-work fallback.

## Escape and Keyboard Policy
- While on `graph_loading`:
  - `Escape` transitions back to `prompt`.
  - `Enter` confirms only when phase is `done`.
- Confirm button auto-focuses when it becomes visible and enabled.

## Debug Proof Logs (Query-Gated)
- Logs are DEV-only and only when `?debugWarmMount=1` is present.
- Added phase transition log format:
  - `[GatePhase] <prev>-><next>`

## Warm-Mount Invariant
- Graph runtime remains mounted in shared graph-class branch.
- Confirm path performs screen transition only (`graph_loading` -> `graph`) and does not add screen-based keys.

## Verification Notes
- Build verification: `npm run build` passed after each run in this step.
- Manual browser verification for `?debugWarmMount=1` mount-id stability and visual flow should be executed in local runtime session:
  - submit prompt -> `graph_loading`
  - wait for done -> Confirm appears
  - click Confirm -> `graph` appears without runtime remount
