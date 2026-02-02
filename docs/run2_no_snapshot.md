# Run 2: Eliminate Cached Snapshot Capture (XPBD Damping)

**Date**: 2026-02-02
**Agent**: Antigravity

## Objective
Detect and eliminate any logic that captures `engine.config` in a closure (snapshotting it) and reuses it for physics ticks, bypassing updates.

## Findings
1.  **Architecture Review**:
    -   `GraphPhysicsPlayground` passes `config` (React state) to `useGraphRendering`.
    -   `useGraphRendering` calls `startGraphRenderLoop` with `engine` and `config`.
    -   `startGraphRenderLoop` only uses the passed `config` for **Initial Seeding** (`ensureSeededGraph`).
    -   The render loop calls `runPhysicsScheduler(engine, ...)`.
    -   `runPhysicsScheduler` calls `engine.tick(dt)`.
    -   `engine.tick(dt)` calls `runPhysicsTick(this, dt)`.
    -   `runPhysicsTick` (in `engineTick.ts`) dispatches to `runPhysicsTickXPBD` (if `useXPBD` is true).
    -   `runPhysicsTickXPBD` (in `engineTickXPBD.ts`) accesses `engine.config.xpbdDamping` directly from the passed engine instance.

2.  **No Closure Leak**:
    -   There is no closure capturing `config` for the duration of the loop.
    -   The `engine` instance reference is stable (`useRef`).
    -   `engine.config` is updated in-place (or replaced via property assignment) by `updateEngineConfig`.

## Conclusion
The system correctly uses "live" property access for configuration during the tick loop. There is no snapshot bug to fix here. The "no effect" issue is likely downstream (Run 3/4/5) or strictly parameter tuning.

## Verification
Code audit confirms correct live access pattern. No changes required.

## Next Steps
Proceed to Run 3 to check if `updateEngineConfig` is updating the *correct* engine instance (Unify Config Source).
