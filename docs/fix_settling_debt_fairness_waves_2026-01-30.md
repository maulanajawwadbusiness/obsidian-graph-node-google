# Fix Report: Invisible Settling, Bounded Debt & Fairness Waves
**Date**: 2026-01-30
**Status**: **APPLIED**
**Files**: `src/physics/engine/corrections.ts`, `src/physics/engine/constraints.ts`

## 1. Executive Summary
We addressed "Post-Input" artifacts where the system continued to move or behave strangely after the user stopped.
*   **Settling**: **INVISIBLE**. Diffusion is disabled at low energy to prevent visible "relaxation" spread.
*   **Debt**: **BOUNDED**. Residual constraint debt is snapped to zero aggressively once small, preventing seconds-long "ghost creep".
*   **Waves**: **ELIMINATED**. Fixed a double-processing bug where "Hot Pairs" were processed twice per frame, causing oscillation waves.

## 2. Root Cause Analysis

### A. Visible Settling (Defect 34)
*   **Symptom**: After stopping, the graph visually "relaxed" or spread out slowly.
*   **Cause**: The **Diffusion Pass** (spreading corrections to neighbors) ran even when the system was nearly at rest. This caused a slow-motion ripple effect.
*   **Fix**: Added an **Energy Gate** (`energy > 0.1`) to the diffusion logic. If the system is low-energy, diffusion stops, locking the structure in place immediately.

### B. Ghost Debt (Defect 35)
*   **Symptom**: Nodes moved seconds after input stopped.
*   **Cause**: Constraint Budgeting created "Correction Debt" (unpaid movement). This debt decayed by 20% per frame but was never cleared until it became infinitesimal (`8e-324`). This allowed tiny residuals to accumulate and push nodes long after the collision.
*   **Fix**: Implemented **Debt Snapping**. If the residual debt drops below `0.5 px`, it is cleared instantly.

### C. Fairness Waves (Defect 36)
*   **Symptom**: Ripples of motion moved through the graph in a "fairness wave" or boomerang.
*   **Cause**: "Hot Pairs" (pairs requiring priority attention) were being processed **Twice Per Frame**: once in the Priority Pass, and again in the main Spatial Scan. This effectively applied double stiffness/force, causing overcorrection and rebound waves.
*   **Fix**: Added a check in the Spatial Scan to skip pairs that are already registered as "Hot". They are now processed exactly once (in the Priority Pass).

## 3. Verification Steps

### Manual Validation
1.  **Stop Test**: Interact vigorously, then release. The graph should freeze *sharply*. No slow spreading.
2.  **Ghost Check**: Collide two nodes hard (creating debt), then stop. They should settle quickly. No creeping motion 2 seconds later.
3.  **Wave Watch**: Under stress (degrade), interaction should not cause outward "pulses". Convergence should be uniform.

## 4. Conclusion
Post-input behavior is now sharp and stable. The system respects the user's "Stop" command.
