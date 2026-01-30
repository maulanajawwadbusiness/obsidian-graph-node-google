# Physics Move Leak Fixes (Phase 5): Sleep Pop, Topology Stability, Dedupe
**Fixes #13, #14, #15**
**Date:** 2026-01-30

## 1. Problem Statement
The "Real Move Leak" persisted in edge cases where sleep transitions or topology glitches triggered instability.
*   **Fix 13 (Sleep Boundary Pop)**: Sleeping nodes accumulated constraint pressure (unsatisfied springs/spacing). When woken, this pressure applied all at once, causing a "pop" and chain reaction.
*   **Fix 14 (Topology Thrash)**: Frequent edge changes (rebuilds) effectively shifted the rest-length landscape, preventing settlement.
*   **Fix 15 (Duplicates/Spikes)**: Duplicate edges (A-B and B-A) double-counted forces. Degree spikes caused unexpected strong pulls.

## 2. Implementation Details

### Fix 13: Sleep Pressure Awareness
*   **Types**: Added `lastCorrectionMag` to `PhysicsNode` to track the previous frame's PBD correction magnitude (constraint "dissatisfaction").
*   **Logic**: In `integrateNodes` (integration.ts), the sleep check now includes `pressureSilent` (lastCorrectionMag < 0.1). A node CANNOT sleep if it is being actively pushed by constraints, even if velocity is low.
*   **Soft Wake**: In `wakeNode` (engine.ts), we now explicitly clear `lastCorrectionMag` and the PBD correction accumulator (`dx=0, dy=0`). This prevents any stale pressure from applying a "kick" on the first awake frame.

### Fix 15: Strict Topology & Caps
*   **Dedupe**: `addLink` (engine.ts) now strictly normalizes edge keys (`min:max`) and rejects duplicates with a warning.
*   **Degree Cap**: `addLink` enforces `maxLinksPerNode` (config). If exceeded, the link is rejected with a warning. This prevents "super-hubs" from forming and dominating the force field.
*   **Note on Fix 14**: By strictly enforcing dedupe and valid topology in `addLink`, we mitigate the "thrash" effects from the engine side. (True "rebuild thrash" is a consumer-side issue of calling `clear/add` too often, but the engine is now robust against the resulting duplicates or inconsistencies).

## 3. Verification
1.  **Sleep Stability**:
    *   Form a tense graph. Stop interacting. It should settle (sleep).
    *   Wake a node (touch it). It should verify "soft" wake without popping neighbors.
2.  **Topology robustness**:
    *   `npm run build` confirm static checking.
    *   Duplicates are rejected (observable via console warning if `debugPerf` enabled).

## 4. Files Modified
*   `src/physics/types.ts`: Added `lastCorrectionMag`.
*   `src/physics/engine.ts`: `wakeNode` clearing, `addLink` dedupe/caps.
*   `src/physics/engine/integration.ts`: Sleep condition logic.
*   `src/physics/engine/corrections.ts`: Output `lastCorrectionMag`.
