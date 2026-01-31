# Forensic Report: Constraint Fight "Correction Tax"
**Date:** 2026-01-31
**Subject:** Eliminating Limit-Cycle Jitter via Velocity Damping

## 1. The Problem
**Symptom:** "Slushy" or jittering clusters where nodes never truly settle.
**Root Cause:** A limit cycle between the **Integrator** (Velocity moves node OUT) and the **Constraint Solver** (Correction pushes node IN).
*   Corrected position is not communicated back to velocity in PBD (by default).
*   Velocity remains high, pushing the node out again next frame.
*   Correction fights back again. Infinite loop.

## 2. The Solution: Correction Tax (Knife-Cut)
**Strategy:** If a node's velocity is fighting the correction (dot product < 0), we **tax** (damp) that velocity immediately inside the constraint solver.

### Implementation
Modified `src/physics/engine/corrections.ts`:
1.  **Detection:**
    ```typescript
    const vDotCorr = node.vx * corrDx + node.vy * corrDy;
    if (vDotCorr < 0) { ... }
    ```
2.  **Taxation:**
    *   Project Velocity onto the Correction vector.
    *   Subtract 90% of this fighting component from the velocity.
    *   `node.vx -= (projFactor * corrDx) * 0.9;`

## 3. Secondary Fix: Soft Reconcile
**Goal:** Prevent micro-jitter when the system is effectively at rest (low energy).
**Mechanism:**
*   Scale the per-node **Correction Budget** by the system temperature (`policy.temperature`).
*   If `temperature < 0.2`, budget ramps down smoothly to 0.
*   Result: Constraints become "softer" and eventually turn off near rest, preventing floating-point noise from triggering visible motion.

## 4. Expected Impact
*   **Conflict%:** Should drop near 0% as fighting velocities are killed.
*   **PostCorrect Δ:** Should decrease rapidly as nodes settle.
*   **Feel:** "Knife-feel" (dead stop) instead of slushy oscillation.

## 5. Verification
*   **Manual:** Verified via code inspection that logic targets only opposing velocities (`vDotCorr < 0`).
*   **Safety:** Uses projection to only remove the *bad* component of velocity, preserving orthogonal motion (sliding along constraint).

---
**Signed:** Antigravity (Physics Forensic Unit)
**Commit:** `physics: correction tax to break constraint fight limit-cycle`
