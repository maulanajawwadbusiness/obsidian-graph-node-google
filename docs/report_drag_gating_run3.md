# Drag Gating Run 3: Disable Degrade Throttling

## Goal
Ensure the physics engine provides maximum fidelity (100% edge coverage, no step-skipping) during user interaction, even if the graph is large.

## Changes
1.  **Effective Degrade Mask**:
    - In `engineTick.ts`, `createMotionPolicy` now receives `effectiveDegrade` which is forced to `0.0` if `engine.dragActive` is true.
    - Previously, high `load` would cause `degradeLevel` -> 1.0, leading to skipped edge checks.
    - Now, drag guarantees `budgetScale = 1.0`.

## Expected Behavior
- **While Dragging**: 
    - `Coverage` (Legacy HUD) should show ~100%. 
    - `degradeScalar` effects (damping, stride) are disabled.
    - Full O(N) or O(E) processing is active.
- **After Release**: Degrade level resumes its calculated value (smoothed over time). Note: `engine.degradeLevel` internal state is not reset, so it remembers the load, but its *effect* was suppressed.

## Safety
- **Perf Risk**: Dragging a massive graph might drop FPS. However, input latency propagation (user feel) is prioritized. If FPS drops, the user sees "heavy" but "correct" movement, rather than "fast" but "broken" (dead body) movement.

## Next Steps
- Run 4: Active Wave (Skipping for now as Run 2 wake-all approach is robust and simpler).
- Run 5: Guardrails (Warning if throttled).
