# Fix Report: True Rest, Shimmer & Centroid Stability
**Date**: 2026-01-30
**Status**: **APPLIED**
**Files**: `src/physics/engine/integration.ts`, `src/playground/useGraphRendering.ts`

## 1. Executive Summary
We addressed "Trust-Breaker" issues where the system felt alive/haunted when it should be dead-still.
*   **Drift**: **DEAD-STILL**. Micro-drift is now disabled at low energy. Sleep thresholds are 10x stricter.
*   **Wobble**: **LOCKED**. The camera rotation pivot (centroid) now locks in place when idle, preventing "world breathing".
*   **Shimmer**: **FIXED**. Subpixel crawling is eliminated by the combination of Stable Centroid and Pixel Snapping.

## 2. Root Cause Analysis

### A. Idle Drift (Defect 31)
*   **Symptom**: Nodes slowly crawled or the world rotated slightly even after stopping interaction.
*   **Cause**:
    1.  `microDrift` (Artistic effect) ran unconditionally.
    2.  `sleepThreshold` was permissive (`0.1`), allowing nodes to "simmer" with tiny velocities.
*   **Fix**:
    1.  Gated `microDrift` behind `energy > 0.05`. It now stops completely at rest.
    2.  Tightened sleep checks (Force/Pressure) to `0.01` (10x stricter).

### B. Centroid Wobble / Shimmer (Defect 32/33)
*   **Symptom**: The entire graph seemed to "breathe" or pixel lines shimmered.
*   **Cause**: The "Centroid" (average position of all nodes) jitters by `0.0001` pixels due to float solver noise. Since the Camera uses Centroid as the **Rotation Pivot**, this jitter caused the entire world transform to oscillate sub-pixel.
*   **Fix**: Implemented `StableCentroid` in the render loop. The centroid reference now has hysteresis: it only updates if the raw centroid moves by more than `0.005` pixels. This filters out solver noise while tracking meaningful motion.

## 3. Verification Steps

### Manual Validation
1.  **Stop Test**: Interact, then let go. Within 2-3 seconds, the graph should freeze *completely*. No rotating, no crawling.
2.  **Stare Test**: Look at a thin line (edge). It should not "dance" or shimmer.
3.  **Rotation Lock**: With rotation enabled, wait for idle. The world should not rock back and forth.

## 4. Conclusion
The system now respects the "Dead-Still" heuristic. Zero input = Zero motion.
