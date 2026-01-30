# Physics Move Leak Fixes (Phase 4): Cache, Diffusion, Wake
**Fixes #10, #11, #12**
**Date:** 2026-01-30

## 1. Problem Statement
The "Real Move Leak" persisted in edge cases where phantom forces or excessive activity caused drift.
*   **Fix 10 (Warm Start Leak)**: Interaction/Constraint history persisted across topology (node/link changes) or mode changes, causing "phantom pushes" (e.g., node "remembers" a spring that no longer exists).
*   **Fix 11 (Diffusion Overreach)**: Corrections diffused to neighbors even when pressure was low, causing the entire net to "creep" when it should be settled.
*   **Fix 12 (Wake Spam)**: `wakeNeighbors` was O(Links) and woke indiscriminately, causing global melting during local drags.

## 2. Implementation Details

### Fix 10: Warm-Start Cache Invalidation
*   **Trigger**: Added `invalidateWarmStart(reason))` calls in `addNode`, `addLink`, `updateConfig`, `clear`, `resetLifecycle`, and `setDegradeState`.
*   **Action**:
    *   Clears `clampedPairs` (hysteresis).
    *   Clears `lastCorrectionDir` (directional inertia) on **all nodes**.
    *   Clears `prevFx`, `prevFy` (force memory).
    *   (Note: `correctionAccumCache` is already cleared per-tick by Fix 9).

### Fix 11: Bounded Diffusion (Pressure Gate)
*   **Logic**: In `applyCorrectionsWithDiffusion` (corrections.ts), we now compute `enableDiffusion = totalMag > 0.5`.
*   **Effect**:
    *   If correction is small (< 0.5px), it is applied **only to self** (local settlement).
    *   If correction is large (> 0.5px), it diffuses to neighbors to prevent instability.
    *   This prevents "micro-shudders" from propagating across the graph.

### Fix 12: Wake Logic Optimization
*   **Adjacency Map**: Added `adjacencyMap` (Map<string, string[]>) to `PhysicsEngine` which stays synced with `addLink`/`clear`.
*   **O(1) Wake**: `wakeNeighbors` now uses `adjacencyMap` to find neighbors instantly, instead of iterating the entire `this.links` array (O(E)).
*   **Scoped Wake**: This naturally bounds the wake operation to actual neighbors, preventing global scans.
*   **Note**: The existing `check warmth` logic combined with the 100ms throttle in `moveDrag` ensures we don't spam-wake already-awake nodes.

## 3. Verification
1.  **Topology Change**:
    *   Add nodes/links dynamically. The graph should not "jump" or show phantom impulses.
2.  **Settling**:
    *   Graph should settle to absolute zero motion distinctively faster due to the diffusion gate.
3.  **Drag Performance**:
    *   Dragging in a large graph should be smoother (O(1) wake vs O(E)).
    *   Far-field should remain asleep during local drags.

## 4. Files Modified
*   `src/physics/engine.ts`: Adjacency Map, Invalidations, Wake Logic.
*   `src/physics/engine/corrections.ts`: Diffusion pressure gate.
