# Repair Report: Interaction & Performance Stability
**Date**: 2026-01-30
**Status**: APPLIED
**Focus**: "Visual Dignity" (Stable Drag, Deterministic Frame Plan, Zero Layout Thrash)

## 1. Drag Coherence (Fix 34)
**Issue**: Using a fixed "start rect" for drag meant that if the camera moved (or degraded logic kicked in), the node position might desync from the cursor ("drift").
**Fix**:
*   The **Drag Update** is now calculated every frame inside the `render` loop (in `useGraphRendering.ts`).
*   It uses the **latest** `updatePlan` input data (client coords) and the **latest** Camera Matrix (re-projected).
*   Camera smoothing is explicitly **bypassed/locked** during interaction (Fix 15/45) to prevent fighting, but if it *did* move, the re-projection logic would handle it.

## 2. Deterministic Update Plan (Fix 35)
**Issue**: Scattered logic for `maxSteps`, `budget`, and `degradeLevel` meant different parts of the frame might use mismatched constraints, or degrade randomly based on micro-timing.
**Fix**:
*   Implemented a centralized **Frame Plan** at the start of `render()`.
*   Calculates `isDragging`, `effectiveBudget`, `maxSteps`, and `degradeState` **once** per frame.
*   Enforces "Infinite Budget" (High Fidelity) immediately if `isDragging` is true, ensuring direct 1:1 response under the hand.

## 3. Kill Layout Thrash (Fix 36)
**Issue**: `onPointerMove` was calling `getBoundingClientRect()` on every event (~125-1000Hz), forcing the browser to re-calculate styles and layout constantly, causing FPS drops.
**Fix**:
*   Implemented `useResizeObserver` in `GraphPhysicsPlayground`.
*   Caches the `contentRect` in a ref.
*   `onPointerMove` reads the **cached** rect (Ref-based, ~0ms cost).
*   Fallback to live read only if cache is empty (first frame).

## Verification
*   **Drag**: Node stays glued to cursor even during heavy physics load or camera potential shifts.
*   **Perf**: Checking performance tab shows "Layout" / "Recalculate Style" only on Resize, not on MouseMove.
*   **Stability**: Interaction always feels same (60fps physics) regardless of background load, due to `SetDegradeState(INTERACTION)` lock.
