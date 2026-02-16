# Step 8 Origin Fix Run 4 - Ref Swap and StrictMode Resilience

Date: 2026-02-16
Run: r4
Scope: strengthen lifecycle safety for element churn and strictmode teardown/replay behavior.

## Changes

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. Flush target safety:
   - flush now exits if resolved active target is detached (`!activeTarget.isConnected`).
   - prevents stale detached element reads during teardown races.
2. Lifecycle cleanup remains strict:
   - pending rAF canceled on cleanup.
   - observer disconnect and ref nulling preserved.
   - disposed guard still blocks post-cleanup state updates.
3. Ref-swap support remains active:
   - effect keyed by current target identity.
   - active target resolution still prefers `elementRef.current`.

## Outcome

- strictmode double invoke and rapid target replacement remain bounded and leak-safe.

## Verification

- `npm run build` passes.
