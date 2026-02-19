# Report 2026-02-19: Analysis Failure + Loading Gate Hardening

## Scope
- Remove first-words fallback behavior for document analysis flows.
- Ensure graph loading gate shows analysis error state instead of success state.
- Ensure Confirm remains disabled on analysis failure.

## Root Cause
1. First-words prefill existed in product document flows, so users could see fallback labels even when analysis failed.
2. `applyAnalysisToNodes(...)` swallowed errors and resolved successfully after setting error state.
   - Callers continued success-only follow-up work.
3. Gate base logic could resolve to `done` when `entryIntent` became `none` after pending payload consumption.
   - This could make failure appear like success flow.

## Changes

### 1) First-words fallback removed
- Removed `applyFirstWordsToNodes(...)` implementation from `src/document/nodeBinding.ts`.
- Removed product path invocations in `src/playground/GraphPhysicsPlaygroundShell.tsx`.

### 2) Analysis failures are explicit and propagated
- Added deterministic error mapping in `src/document/nodeBinding.ts`:
  - unauthorized/forbidden -> login message
  - insufficient balance -> top-up message
  - network/timeout -> server unreachable message
  - default -> generic analysis failure message
- `applyAnalysisToNodes(...)` now:
  - sets mapped user-safe error
  - rethrows original error so callers do not continue success flow

### 3) Gate phase contract hardened
- Updated `src/screens/appshell/render/graphLoadingGateMachine.ts`:
  - error phase has precedence before `entryIntent === 'none'`
  - error phase is latched while screen is `graph_loading`
- Updated gate copy in `src/screens/appshell/render/GraphLoadingGate.tsx`:
  - title is `Analysis Failed`
  - fallback message is explicit retry guidance
- Updated fallback gate message constant in `src/screens/AppShell.tsx` to match.

### 4) Drop-path safety
- Drag-drop analysis call now catches rejected promise explicitly to avoid unhandled rejection logs.

## User-visible Behavior After Change
- If analysis fails, loading gate shows explicit analysis failure message.
- Confirm button is not actionable in error state.
- User must go back to prompt to retry.
- No first-words fallback labels are applied in product analysis flow.

## Manual Verification Checklist
1. Submit prompt text with forced analyzer failure.
   - Gate phase becomes error.
   - Error message is visible.
   - Confirm is disabled.
2. Submit file with forced analyzer failure.
   - Same error behavior as text flow.
   - No first-words labels appear.
3. Submit successful analysis.
   - Gate reaches done.
   - Confirm is enabled and transitions to graph.
4. Use drag-drop path with analysis failure.
   - Error is visible in runtime state.
   - No unhandled rejection crash.

## Notes
- This change keeps existing input shielding and gate interaction lock behavior intact.
- No topology mutation seams were changed.
