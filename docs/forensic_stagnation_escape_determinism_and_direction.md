# Forensic Report: Stagnation Escape Determinism & Direction

**Date:** 2026-02-01
**Subject:** Non-deterministic jitter & constraint-fighting escape motors.

## 1. Mechanisms Identified

| Mechanism | File | Deterministic? | Direction Logic | Risk |
| :--- | :--- | :--- | :--- | :--- |
| **Singularity Guard** | `forcePass.ts` | **NO** (`Math.random`) | Random Direction | **High:** Fires on overlap (0,0 dx/dy). |
| **Impulse Kick** | `impulse.ts` | **NO** (`Math.random`) | Random Angular Vel | **Low:** One-shot only. |
| **Low-Force Escape** | `lowForceStagnationEscape.ts` | YES (Hash) | Toward Loose Neighbor | **Medium:** Can fight repulsion/stiffness. |
| **Edge Shear Escape** | `edgeShearStagnationEscape.ts` | YES (Hash) | Perpendicular to Edge | **Medium:** Can fight constraints? |
| **Phase Diffusion** | `localPhaseDiffusion.ts` | YES (Hash) | Rotates Velocity | **Low:** Only runs if speed > 0.1. |
| **Angular Decoherence** | `angularVelocityDecoherence.ts` | YES (Hash) | Rotates Velocity | **Low:** Only runs if speed > 0.1. |

## 2. Issues Found

### A. Non-Determinism (Singularity Guard)
`forcePass.ts` uses `Math.random()` when nodes perfectly overlap.
-   **Fix:** Use `seededRandom(node.id + frameIndex)` to ensure identical simulation replay.

### B. Constraint Awareness (The Fighting Problem)
Current escape motors (Low-Force, Edge Shear) choose direction based on *topology* (neighbors) or *geometry* (perpendicular), but ignore *physics constraints* (PBD correction).
-   **Problem:** If PBD is actively correcting a node "Right", and Escape pushes "Left", they fight. This creates a vibration loop (Action -> Correction -> Action).
-   **Fix:** Check `dot(escapeDir, lastCorrectionVec)`.
    -   If `< -0.5` (Opposing), flip or rotate the escape force.
    -   Or suppress escape if opposition is strong.

### C. HUD Visibility
-   Need to visualize "Loop Suspects" (count of times Escape fought PBD).
-   Need to show active direction mode.

## 3. Plan

1.  **Data Model:** Add `lastCorrectionX`, `lastCorrectionY` to `PhysicsNode`.
2.  **Engine:** Populate `lastCorrectionVec` in `engineTick.ts` (post-correction).
3.  **Randomness:** Replace `Math.random` with `pseudoRandom(seed)`.
4.  **Direction Logic:**
    -   In `lowForceStagnationEscape`: Check `dot(driftDir, lastCorrectionVec)`. If < 0, flip sign.
    -   In `edgeShearStagnationEscape`: Check `dot(shearDir, lastCorrectionVec)`. If < 0, flip sign.
5.  **HUD:** Add "Loop Suspects" counter.
