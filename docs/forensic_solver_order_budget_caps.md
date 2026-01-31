# Forensic Report: Solver Order Bias & Budget Motors

## 1. Constraint Order Bias
-   **Link Constraints**: `applyEdgeRelaxation` iterates `engine.links` linearly.
    -   *Risk*: Deterministic order means the same link always "wins" or "loses" in a conflict every frame. This creates bias (drift) or cyclic limit cycles (A pushes B, B pushes C, C pushes A... repeat).
-   **Spacing Constraints**: `applySpacingConstraints` iterates `activeNodes` with nested loops `(i, j=i+1)`.
    -   *Risk*: Lower index nodes always push higher index nodes first? No, interaction is symmetric, BUT the accumulation order into `correctionAccum` is fixed.
    -   *Accumulation*: `correctionAccum` sums `dx/dy`. Order of summation doesn't matter for floats (mostly), BUT the *application* of correction happens later.
    -   *The Real Issue*: `applyEdgeRelaxation` modifies `accum`. If multiple links touch a node, the *order* they add to `accum` is irrelevant (summation).
    -   *Wait*: Is order bias actually a problem if we just sum corrections?
    -   *YES*: If we have sequential constraints (e.g. Iterative Solver like Gauss-Seidel).
    -   *BUT*: This codebase uses an **Accumulator** (Jacobi-style?).
    -   *Investigation*: `correctionAccum` gathers ALL corrections, then `corrections.ts` applies them.
    -   *Result*: This is a Jacobi solver (Parallel accumulation).
    -   *Order Bias Risk*: **Low** for the *Summation*.
    -   *However*: `applyRepulsion` (Forces) modifies `v` or `f` directly.
    -   *Wait*: `constraints.ts` logic is purely PBD accumulation.
    -   *Re-evaluation*: Order bias is less critical in Jacobi than Gauss-Seidel.
    -   *BUT*: `applyEdgeRelaxation` adds to `accum`. `applySpacing` adds to `accum`.
    -   If the sequence of addition is constant, float errors are constant.
    -   The user reported "cyclic limit cycles".
    -   Maybe `hotPairs` or `engine.links` order affects "Priority Pass" in Spacing?
    -   *Priority Pass*: `hotPairs` are processed first. `hotPairs` is a Set (iteration order is insertion order).
    -   *Conclusion*: Shuffling `engine.links` or `activeNodes` might still help break subtle symmetries or "first-mover" artifacts if any logic *does* depend on order (e.g. `hotPairs` registration).

## 2. Correction Budget & Debt
-   **Mechanism**: `nodeBudget` caps `totalMag`.
-   **Clipping**: If `totalMag > budget`, `scale` is applied.
-   **Debt**: `node.correctionResidual` stores the *unpaid* portion (`budgetScale < 1`).
-   **Motor Risk**: "Releasing" debt next frame acts as a hidden force.
    -   Current logic: `decay` is `0.8` or `0.5`.
    -   If a node is perpetually clipped, debt refills every frame.
    -   If `residual` is added to `accDx` next frame, it effectively increases the demand.
    -   This can create a "Pulse": Accumulate -> Exceed -> Clip -> Accumulate More -> Clip -> ...
-   **Fix**:
    -   Instead of storing debt, we should **Soften** the constraint (Compliance).
    -   If `totalMag > budget`, increasing "stiffness" of the budget constraint?
    -   Better: Simply do NOT store debt if we are budget-limited.
    -   "Forget" the impossibility. Let the laws of physics (forces) handle the rest?
    -   User instruction: "remove or redesign [debt]".
    -   Plan: Remove `correctionResidual` entirely or make it purely a "momentum preservation" (very weak).
    -   Constraint: User said "enforce a no debt motor invariant". "Clipped remainder applied later" is a debt motor.

## 3. Per-Node Cap
-   **Current**: `nodeBudget` is fixed (derived from `maxNodeCorrectionPerFrame`).
-   **Problem**: Some nodes (hubs) naturally need more movement.
-   **Fix**:
    -   **Adaptive Cap**: If a node hits cap often, *increase* its specific cap temporarily?
    -   Or **Distribute**: If we have a global budget, give more to needy nodes?
    -   Or **Soften**: If node hits cap, tell constraints to relax (reduce `stiffness`).

## 4. Plan
1.  **Order**: Implement "Frame-Rotating Start Index" for `links` loop in `constraints.ts`. (Cheap, deterministic).
2.  **Budget**: Remove `correctionResidual` storage for Budget Cuts. Only store it for "Physical Resistance" (if any)? Actually, just remove it. "Debt" is dangerous.
3.  **Adaptive Cap**:
    -   Track `budgetHits`.
    -   If high, increase `nodeBudget` by 10% next frame (up to 2x).
    -   Decay if not hit.
