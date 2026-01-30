# Physics Move Leak Fixes (Phase 8): Degrade-1:1 Coverage Crawl
**Fixes #22**
**Date:** 2026-01-30

## 1. Problem Statement
The "Real Move Leak" persisted in edge cases where `degradeLevel` reduced simulation coverage (e.g. running spacing checks on only 1/K pairs per frame).
*   **Fix 22 (Far-Field Crawl)**: While the interaction local-region was crisp (prioritized), the far-field regions would "crawl" slowly because they were only partially constrained each frame. This sparse coverage meant errors accumulated and were corrected in a "stuttering" pattern that looked like movement.

## 2. Implementation Details

### Fix 22: Hot Pair Prioritization
*   **Residual Tracking**: Introduced `spacingHotPairs` (Set<string>) in `PhysicsEngine`.
*   **Discovery**: In `applySpacingConstraints` (Scan Pass), any pair that violates the soft distance threshold (`d < D_soft`) is marked as "Hot".
*   **Priority Pass**: At the start of the *next* frame's `applySpacingConstraints`, we iterate `hotPairs` **first**, forcing a check on them regardless of the current `pairStride`.
*   **Resolution**: If a Hot Pair is found to be well-separated (`d > 0.95 * D_soft`) during the Priority Pass, it is removed from the set.
*   **Result**: 
    *   **Hot Regions**: Receive 1:1 (every frame) coverage because they are in the Hot Set.
    *   **Cold Regions**: Receive 1:K (strided) coverage based on performance settings.
    *   **Crawl Eliminated**: Because violating pairs are upgraded to 1:1 immediately, they settle quickly and stay settled, preventing the "slow crawl" artifact.

## 3. Verification
1.  **Degraded Stability**:
    *   Force `degradeLevel=1` or `2`.
    *   Settle graph.
    *   Result: Graph settles to a stop. No background creep.
2.  **Interaction**:
    *   Drag a node into a "cold" cloud.
    *   The cloud wakes up, becomes "hot" (added to set), and reacts crisply.
    *   As it settles, it leaves the hot set and returns to efficient strided checks.

## 4. Files Modified
*   `src/physics/engine.ts`: Added `spacingHotPairs` and updated calls.
*   `src/physics/engine/constraints.ts`: Implemented Priority Pass and Scan Logic.
