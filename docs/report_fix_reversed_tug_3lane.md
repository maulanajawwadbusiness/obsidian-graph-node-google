# Reversed Tug 3-Lane Assault Report

## Lane A: Sign/Gradient Correctness

### A.1 Analysis of `engineTickXPBD.ts`
*   **Distance**: `dx = nA.x - nB.x` (Vector `B->A`).
*   **Gradient**: `gradX = dx / dist` (Points `B->A`).
*   **Error (C)**: `dist - restLen`. Stretched (`C>0`) implies we must pull A and B closer.
    *   Target A: Move towards B (Direction `A->B`, i.e., `-gradX`).
    *   Target B: Move towards A (Direction `B->A`, i.e., `+gradX`).
*   **Delta Lambda**: `deltaLambda = (-C - alpha * lambda) / denom`.
    *   If `C > 0`, `deltaLambda` is **Negative**.
*   **Current Code Implementation**:
    ```typescript
    pxA = -wA * deltaLambda * gradX;
    pxB = +wB * deltaLambda * gradX;
    ```
*   **Sign Check**:
    *   `deltaLambda` is negative.
    *   `pxA = -1 * (-) * (+) = +`. Positive `gradX` points `B->A`. A moves *away* from B. **FAIL**.
    *   `pxB = +1 * (-) * (+) = -`. Negative `gradX` points `A->B`. B moves *away* from A. **FAIL**.
*   **Conclusion**: The signs are flipped. The corrections are pushing nodes apart when they should be pulling them together (Explosion/Reversal).

### A.3 Action Taken (Fix)
*   **Signs Flipped**: Changed correction application to:
    ```typescript
    let pxA = +wA * deltaLambda * gradX;
    let pyA = +wA * deltaLambda * gradY;
    let pxB = -wB * deltaLambda * gradX;
    let pyB = -wB * deltaLambda * gradY;
    ```
    *   **Logic**: `deltaLambda` is negative (shrink). `gradX` is B->A.
    *   `pxA`: `(+) * (-) * (B->A)` = `-(B->A)` = `A->B` (Towards Neighbor). **CORRECT**.
    *   `pxB`: `(-) * (-) * (B->A)` = `+(B->A)` = `B->A` (Towards Neighbor). **CORRECT**.

### A.4 Verification (HUD)
*   **New HUD Section**: "XPBD Fix 7.5: 3-Lane Clean"
*   **Lane A**: Look at `DotA` and `DotB`.
    *   `DotA` should be **Negative** (correction opposes gradient).
    *   `DotB` should be **Positive** (correction aligns with gradient, since gradient is B->A and B needs to move to A).

## Lane B: Pinned/Kinematic Seam

### B.1 Analysis
*   `applyKinematicDrag` runs before `solve`.
*   `dragTarget` is applied to `node.x` and `node.vx`. `node.prevX` is synced to `oldX`.
*   In Solver, `wA = 0` if `nA.id === draggedNodeId`.
*   Result: `pxA` is 0. Dragged node position is NOT corrupted by solver.

### B.2 Verification (HUD)
*   **Lane B**: Check `Drag: ON` and `InvM=0: YES` while dragging.
*   This confirms the solver sees the node as infinite mass.

## Lane C: Ghost Velocity

### C.1 Analysis
*   `reconcile` runs after `solve`.
*   Baseline: `preSolveSnapshot` (taken AFTER drag application).
*   `dx = node.x - preSolveSnapshot`.
*   For dragged node, `dx` is 0 (since solver didn't move it).
*   `node.prevX` remains set by `applyKinematicDrag` (Lines 70-71: `prevX = oldX`).
*   Result: `x - prevX` correctly captures the drag velocity. `dx` from reconcile is 0. No double counting. No ghost velocity injection.

### C.2 Verification (HUD)
*   **Lane C**: Check `MaxVel` and `RelGhost`.
*   `MaxVel` should be reasonable (not 10,000+).
*   `RelGhost` should be 0 after release.
