# Comprehensive Forensic Report: Physics Hardening
**Date:** 2026-02-01
**Topic:** Micro-Slip, Rest Detection, and Determinism

## Executive Summary
We have completed a major hardening of the physics engine to address three critical stability issues:
1.  **"Heartbeat" Vibration:** Caused by periodic micro-slip injections fighting damping.
2.  **Constraint Fighting:** "Escape" motors pushing nodes against their PBD constraints.
3.  **Insomnia & Oscillation:** Strict "all-or-nothing" rest thresholds preventing sleep, and lack of hysteresis causing state flapping.

All systems are now **deterministic** (no `Math.random`), **constraint-aware**, and **adaptive**.

---

## 1. Micro-Slip "Heartbeat" Fix
**Problem:** `staticFrictionBypass` injected energy whenever velocity dropped near zero. This created a 1-2Hz energy pulse.
**Fix:**
-   **True Stuck Predicate:** Replaced `VEL < EPS` with `StuckScore > 0.5`.
    -   `StuckScore` combines **Low Velocity** AND **High Pressure** (Correction Mag).
-   **Mandatory Cooldown:** Enforced 1.0s cooldown per node between injections.
-   **Files:** `staticFrictionBypass.ts`, `engineTick.ts`.

## 2. Stagnation Escape & Determinism
**Problem:**
-   `forcePass.ts` used `Math.random()` for singularity guards (non-deterministic).
-   Escape motors (Low Force, Edge Shear) pushed nodes in directions that often opposed PBD constraints, causing vibration.
**Fix:**
-   **Determinism:** Replaced all `Math.random()` with `pseudoRandom(seed)`.
-   **Constraint Awareness:**
    -   Added `lastCorrectionVec` to `PhysicsNode`.
    -   In escape motors, we check `dot(EscapeDir, LastCorrectionVec)`.
    -   If `dot < 0` (Fighting), we **FLIP** the direction to assist the constraint.
-   **Files:** `random.ts`, `lowForceStagnationEscape.ts`, `edgeShearStagnationEscape.ts`.

## 3. Rest Truth & State Ladder
**Problem:**
-   Rest required 100% of nodes to match strict thresholds. Outliers kept the whole system awake ("Insomnia").
-   State machine lacked hysteresis, flipping immediately between Moving/Cooling.
**Fix:**
-   **Adaptive Thresholds:**
    -   Individual: `Speed < 0.05`, `Pressure < 0.25`, `Force < 0.1`.
    -   Global: Requires **95% Calm** (allows 5% outliers).
-   **Confidence Machine:**
    -   `settleConfidence` (EMA) tracks stability over time.
    -   **Ladder:**
        -   Move -> Cool: Conf > 0.5.
        -   Cool -> Sleep: Conf > 0.95.
        -   Sleep -> Move: Conf < 0.8.
-   **Files:** `engineTick.ts`, `physicsHud.ts`.

## 4. Diagnostics & Forensics
We added extensive HUD metrics to verify these behaviors:
-   **Forensic: Micro-Slip:** `Fires/Sec`, `Stuck Score`.
-   **Forensic: Escape:** `Loop Suspects` (Flip Count).
-   **Forensic: Rest:** `State` (with duration), `Flips/10s`, `Calm %`, `Blockers`.

## 5. Verification Results
-   **At Rest:** `Escape Fires = 0`, `State = Sleep`.
-   **Jammed Pile:** Fires occasionally (~1Hz), then settles.
-   **Reset:** Simulation is bit-exact identical (Deterministic).
