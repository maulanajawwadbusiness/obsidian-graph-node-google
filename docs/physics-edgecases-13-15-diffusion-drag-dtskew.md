# Physics Edge Cases #13-#15 Analysis

## 1. Forensic Findings

### Edge Case #13: Correction Diffusion
**Current State (`corrections.ts`):**
- **Mechanism:** Corrections exceeding `maxNodeCorrection` are clamped.
- **Diffusion:** If `degree > 1`, 60% of the correction is passed to neighbors.
- **Problem:**
    - Diffusion is "dumb"; it pushes to all neighbors equally.
    - No depth limit beyond 1-hop (though recursive calls aren't here yet, the pressure builds up).
    - Can cause "soggy" feel if diffusion happens every frame for every node.
- **Fix:**
    - Cap `maxDiffusionNeighbors` (user request says "Bounded + local-first").
    - Explicitly prioritize local correction (maybe 50/50 split or adaptive).
    - Add "Interaction Bubble": if node is awake/dragged, reduce diffusion to keep it sharp.

### Edge Case #14: Drag Leash & Wake Logic
**Current State:**
- `engine.ts`: `grabNode` and `moveDrag` call `wakeNode` + `wakeNeighbors`.
- `dragVelocity.ts`: Overrides `x,y` directly.
- **Problem:**
    - `wakeNeighbors` calls `wakeNode` on all neighbors.
    - If dragging fast, we wake neighbors every frame. This injects energy (warmth=1 resets damping).
    - "Energy Leaks": If drag target moves faster than physics can resolve, neighbors get yanked hard.
- **Fix:**
    - **Wake Throttling:** Only wake neighbors if `lastWakeTime` > threshold (e.g. 100ms).
    - **Drag Damping:** Ensure released nodes have critical damping (already in `releaseNode`, checking again).

### Edge Case #15: Temporal Decoherence (Dt Skew)
**Current State (`integration.ts`):**
- **Logic:** `dtMultiplier = 0.97 + skew * 0.06` (±3%).
- **Gate:** Only `!preRollActive && energy > 0.85`.
- **Problem:**
    - Dt skew breaks determinism and can make adjacent nodes drift apart.
    - It's a "hack" to break symmetry.
- **Fix:**
    - Narrow the skew (e.g. ±1%).
    - Add Debug Toggle.
    - Ensure dragged nodes force `dtSkew = 1.0` (User request: "Never let dt skew affect drag authority").

## 2. Proposed Fixes

### Fix #13: Bounded Diffusion
- Modify `corrections.ts`:
    - Cap `neighborLimit` to 3 or 4 (already partially there logic-wise, need to tune).
    - If `node.isSleeping` or `node.warmth < 0.1`, disable diffusion? No, diffusion wakes people up.
    - Add `interactionGate`: if `engine.draggedNodeId` is neighbor, minimal diffusion.

### Fix #14: Drag Pumping
- Modify `engine.ts` > `moveDrag`:
    - Throttle `wakeNeighbors`: `if (now - lastWake > 100) wakeNeighbors`.
- Modify `dragVelocity.ts`:
    - Cap implied velocity? The code computes `node.vx = dx/dt`. If `dx` is huge, `vx` is huge.
    - Clamp `vx/vy` to `maxVelocity` even for dragged nodes?

### Fix #15: Constrained Dt Skew
- Modify `integration.ts`:
    - Reduce range to 0.99 - 1.01.
    - Check `engine.draggedNodeId`. If `node.id == draggedNodeId` (or neighbor), force `dt = 1.0`.

## 3. Instrumentation
- **Diffusion:** Log `diffusedCount`.
- **Drag:** Log `dragVelocity` vs `physicsVelocity`.
- **Skew:** Log `dtVariance`.

## 4. Implementation Results (Completed)

### Fix #13: Bounded Diffusion
- **Corrections.ts:** Added bounds to diffusion:
    - `maxDiffusionNeighbors` (or default 3) limit.
    - Local priority: Self always retains ≥50% of the correction.
    - Result: Dense clusters no longer feel "soggy" or drift endlessly.

### Fix #14: Drag Leash & Wake
- **Wake Throttling:** `moveDrag` now checks `lastWakeTime`. Neighbors only wake every 100ms max.
- **Result:** Rapid scrubbing no longer "boils" the surrounding graph with excess energy.

### Fix #15: Constrained Dt Skew
- **Reduction:** Skew magnitude reduced from ±3% to ±1% (0.02 range).
- **Gating:** Dt Skew is forced to 0 for nodes currently being dragged.
- **Result:** Deterministic interaction is preserved while still preventing perfect symmetry equilibrium in the rest of the graph.

