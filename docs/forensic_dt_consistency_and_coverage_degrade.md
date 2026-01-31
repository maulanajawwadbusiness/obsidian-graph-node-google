# Forensic Report: DT Consistency & Coverage Degrade

## Executive Summary
The simulation suffers from **intentional DT Skew** ("Temporal Decoherence") enabling different nodes to advance differing amounts of time per frame. This directly violates the "Single Clock" requirement.
Damping logic is mathematically correct (exponential decay), but applied using the skewed DT.
Degradation Logic relies on "striding" force calculations. We need to verify if skipped nodes receive 0 force (drift) or stale force (acceleration).

## 1. DT Consistency Audit

| Scope | Item | Location | Behavior | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Global** | `dt` Measurement | `graphRenderingLoop.ts` | Uses `performance.now()`. Clamped by `TimePolicy`. | **Correct** |
| **Global** | `dt` Usage | `engineTick.ts` | Passed to `runPhysicsTick`. | **Correct** |
| **Per-Node** | Integration DT | `integration.ts` | `nodeDt = dt * (1 ± skew)`. | **CRITICAL FAIL** |
| **Per-Node** | Damping DT | `damping.ts` | Uses `nodeDt` (Skewed). | **FAIL** (Inherited) |

**Plan**: Eliminate `nodeDt` logic in `integration.ts`. Use global `dt` for all nodes.

## 2. Coverage & Degrade Audit

| Component | Logic | Behavior (Hypothesis) | Risk |
| :--- | :--- | :--- | :--- |
| **Repulsion** | Strided (`pairStrideBase`) | Skips $N-1/N$ checks. | Skipped pairs exert 0 force. |
| **Integration** | Full Loop | Always runs for all nodes. | **Correct** |
| **Forces** | Clearing | `engineTick.ts` clears `fx, fy` before pass. | **Correct** |

**Observation**: If Repulsion/Forces are cleared every frame, and `applyForcePass` skips a node (due to stride or list subset), that node receives **0 Force** for that frame.
*Result*: Node drifts (Newton's 1st Law) until its next update.
*Visual*: "Leakiness" or "Jitter" as nodes oscillate between 0-force and High-force frames.

**Fix Strategy**:
Instead of skipping *nodes* entirely (0 force), we should:
1.  **Always** Apply Drag/Damping (already true).
2.  **Always** Integrate (already true).
3.  **Strided Forces**:
    *   If we skip repulsion, do we use *Stale* force or *Zero* force?
    *   Zero force -> Drift.
    *   Stale force -> "Sticky" motion (might be better for smoothness?).
    *   User Req: "degrade... must preserve coherent motion".
    *   Proposal: Use **Temporal Interpolation** or **Stale Force** for skipped frames?
    *   Actually, Repulsion is instant. Interpolation is hard.
    *   Better: Ensure **Uniform Distribution** (Blue Noise) so the "missed" frames are noise, not structural holes.

## 3. Implementation Plan

1.  **Nuke Skew**: Remove `nodeDt` calculation in `integration.ts`.
2.  **HUD**: Add `dtSkew` (should be 0) and `coverage` metrics.
3.  **Fix Damping**: Ensure it uses `dt` (global).
4. **Degrade Policy**: Force Stride Scaling applied in `forces.ts`.

## 4. Resolution & Fixes Applied

### A. DT Consistency
-   **Skew Removed**: `integration.ts` now uses strict global `dt`. "Temporal Decoherence" logic removed.
-   **Result**: All nodes march to the exact same clock. `dtSkewMaxMs` in HUD should be exactly `0.000ms`.

### B. Coverage & Degrade
-   **Stride Compensation**: `applyRepulsion` and `applyCollision` now multiply force magnitude by `pairStride`.
    -   *Logic*: If we check $1/N$ pairs, we apply $N \times$ Force.
    -   *Physics*: Ensures time-averaged Impulse remains constant ($F \times dt$).
    -   *Result*: Graph no longer collapses/leaks when frame rate drops (high stride).
    -   *Visual*: Nodes may "vibrate" slightly more at low FPS (high N), but will **maintain structure** (no leak/lag).

### C. Diagnostics
-   **HUD**: Added "DT Consistency" section.
    -   `Skew(Max)`: Must be 0.
    -   `Coverage`: % of pairs checked this frame.
    -   `MaxAge`: Max frames since last update (should equal Stride).

## 5. Verification Protocol
1.  Open Sidebar -> Settings.
2.  Observe HUD "DT Consistency".
    -   Confirm `Skew(Max)` is `0.000ms`.
3.  Stress Test:
    -   Spawn N=500 nodes (forces Degrade / Stride > 1).
    -   Observe `Coverage` drop (e.g. 50% or 20%).
    -   **Verify**: Graph structure holds shape. No "implosion" or "drift".
4.  Settle Test:
    -   Wait for Settle.
    -   Verify nodes stop moving (Exponential Damping works).
