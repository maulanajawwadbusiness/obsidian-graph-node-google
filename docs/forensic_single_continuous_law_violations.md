# Forensic Report: Single Continuous Law Violations
**Date**: 2026-01-31
**Subject**: Discontinuities in Physics "Laws"

## Overview
This report inventories all "hard switches" (discrete logic gates) in the physics engine that violate the **Single Continuous Law** doctrine. These switches cause behavior to fragment across different node counts and states, creating "mode pops" rather than smooth blends.

## 1. Top-Level Performance Gates (The "N-Thresholds")
**Violation**: Discrete switching of `perfMode` based on hard node/link counts.
**Location**: `src/physics/engine/engineTick.ts` -> `updatePerfMode`
**Behavior**:
- `if (n >= 180)`: Normal -> Stressed
- `if (n >= 260)`: Stressed -> Emergency
- `if (n >= 400)`: Emergency -> Fatal
**Impact**:
- `degradeLevel` jumps 0 -> 1 -> 2.
- Pass frequencies (Repulsion, Spacing, Springs) snap from 1:1 to 1:2 or 1:3 instantly.
- **Law Fix**: Replace discrete `perfMode` with a continuous `degradeScalar` (0.0 to 1.0) derived from `avgFrameTime` or smoothed `nodeCount`. Map pass probabilities or budget scalars to this curve.

## 2. Spacing Gate (Energy Threshold)
**Violation**: Hard toggle of spacing force based on energy.
**Location**: `src/physics/engine/engineTick.ts`
**Behavior**:
- `spacingGateActive` toggles true/false at `energy < 0.05` / `energy > 0.08`.
- Although `spacingGate` smoothly ramps, the *decision* to start ramping is binary.
- **Law Fix**: `policy.spacingStrength` derived linearly from `energy` (inverse sigmoid) via `motionPolicy.ts`.

## 3. Diffusion Gate (Mag Threshold)
**Violation**: Binary cutoff for diffusion corrections.
**Location**: `src/physics/engine/corrections.ts` -> `applyCorrectionsWithDiffusion`
**Behavior**:
- `const enableDiffusion = totalMag > 0.5 && policy.diffusion > 0.01`.
- If correction is 0.49px, diffusion is OFF. If 0.51px, diffusion is ON.
- **Law Fix**: `diffusionStrength = smoothstep(0.2, 0.8, totalMag) * policy.diffusion`. Use continuous blending.

## 4. Hub Privilege (Degree Threshold)
**Violation**: Hard "Hub" definition vs "Leaf".
**Location**: `src/physics/engine/constraints.ts`
**Behavior**:
- `const aHubScale = aDeg >= 3 ? ... : 1;`
- A node with degree 2 is a Leaf (100% constraint). A node with degree 3 is a Hub (softer constraint).
- **Law Fix**: `hubScalar = smoothstep(2.0, 5.0, degree)`. Degree 2 is 0% hub, Degree 5 is 100% hub. Blend constraint relief linearly.

## 5. Pre-Roll Phase (Init Mode)
**Violation**: Distinct physics rules for first N frames.
**Location**: `src/physics/engine/engineTick.ts` -> `preRollActive`
**Behavior**:
- Special "topology-softened springs" only during `preRollFrames`.
- **Law Fix**: Remove `preRollActive` bool. Use `policy.earlyExpansion` (time/temp based) as the ONLY governor of startup dynamics.

## 6. Idle/Coma (Hard Freeze)
**Violation**: Discrete state change from "Simulating" to "Frozen".
**Location**: `src/physics/engine/engineTick.ts`
**Behavior**:
- `if (idleFrames > 60)` -> Snap everything to zero and exit.
- **Law Fix**: `settleScalar` (0..1). As confidence approaches 1.0, damp velocities to zero exponentially. If `settleScalar > 0.99`, then safe to skip (optimization, not mode switch).

## 7. Degrade-Level Pass Skipping
**Violation**: Modulo-based skipping (`% 2`, `% 3`).
**Location**: `src/physics/engine/engineTick.ts`
**Behavior**:
- `repulsionEvery = degradeLevel === 1 ? 2 : ...`
- Creates beat frequencies.
- **Law Fix**:
    - **Option A (Stochastic)**: `if (random() < scalar) runPass()`.
    - **Option B (Continuous Budget)**: Run every frame, but scale `maxChecks` or `budget` by `degradeScalar`. (Preferred for "Visual Dignity").

## 8. Hot-Pair Fairness (Discrete Set)
**Violation**: Binary "Hot" vs "Cold" list.
**Location**: `src/physics/engine/constraints.ts`
**Behavior**:
- Pairs are added/removed from `hotPairs` set.
- **Law Fix**: Hard to remove completely (optimization), but the *criteria* for entry should be continuous pressure metrics, not just "distance < D". (Lower priority, focused on major law switches first).

---

## The Unified Motion Policy
All booleans above replace with **Scalars (0.0 - 1.0)**:

1.  **`tempScalar`**: System energy/activity (0=Frozen, 1=Eruption).
2.  **`densityScalar`**: Local crowding (0=Void, 1=Black Hole).
3.  **`hubScalar`**: Node importance (0=Leaf, 1=Core Hub).
4.  **`degradeScalar`**: System pressure (0=Idle, 1=Meltdown).
5.  **`settleScalar`**: Rest confidence (0=Active, 1=Sleeping).

Every force/constraint reads these scalars to modulate its own parameters. No one reads `nodeCount` or `frameIndex` directly.
