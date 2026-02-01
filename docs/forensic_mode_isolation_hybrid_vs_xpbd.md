# Forensic Report: Mode Isolation (Hybrid Core vs XPBD Core)
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** PROPOSAL (Ready for Code)

## 1. Goal: Knife-Sharp Isolation
To prevent "Hybrid Accidents" (e.g., legacy velocity heuristics fighting XPBD compliance constraints), we must strictly separate the execution pipelines.

*   **Legacy Mode**: The current heuristic-heavy, PBD-lite engine.
*   **XPBD Mode**: A clean, physical simulation based on Extended Position-Based Dynamics.

**Rule**: A single frame must NEVER run passes from both modes.

## 2. Mode Definitions

### A. Legacy Core (Existing)
*   **Integrator**: Semi-Implicit Euler with "History-Aware V-Mods".
*   **Solver**: `applyCorrectionsWithDiffusion` (Accumulator-based PBD).
*   **Feedback**: Heuristic "Injectors" (`applyEdgeShearStagnationEscape`, `applyLocalPhaseDiffusion`) to fix oscillation/stagnation.
*   **Forces**: `applyForcePass` (Legacy Repulsion, Collision, Springs).

### B. XPBD Core (New)
*   **Integrator**: Explicit Prediction ($x^* = x + v \Delta t$) -> Solve -> Velocity Update ($v = (x - x_{prev}) / \Delta t$).
*   **Solver**: `solveXPBDConstraints` (Gauss-Seidel / Small-Step).
*   **Feedback**: None (Compliance handles stiffness).
*   **Forces**: Unified Gravity, XPBD-Repulsion (or Force-based if using compliant contact), Drag.

### C. Forbidden Mixes (The Blacklist)
Running these in XPBD Mode is a **Critical Failure**:
1.  `applySpacingConstraints`: Legacy PBD logic. Conflicts with XPBD Contact.
2.  `applyEdgeRelaxation`: Artificial length smoothing. Destroys stiffness accuracy.
3.  `applyAngularVelocityDecoherence`: Magic jitter fix. Hides solver instability.
4.  `applyCorrectionsWithDiffusion`: The old PBD solver.
5.  `applyForcePass`: Legacy force accumulator (unless cleared and repurposed, but risky).

## 3. Tick Pipeline Comparison

| Step | Legacy Pipeline | XPBD Pipeline |
| :--- | :--- | :--- |
| **1. Preflight** | `runTickPreflight` (Firewall) | `runTickPreflight` (Firewall) |
| **2. DT Policy** | `TimePolicy` (Dynamic/Adaptive) | `TimePolicy` (Strict/Fixed preference) |
| **3. Forces** | `applyForcePass` (Complex) | `applyDrag` + `applyGravity` |
| **4. V-Mods** | **HEAVY** (Angle, DistBias, etc.) | **MINIMAL** (Drag only) |
| **5. Integrate** | `integrateNodes` (Euler) | `integrateNodes` (Prediction) |
| **6. Micro** | `applyLocalPhaseDiffusion` etc. | **NONE** |
| **7. Solve** | `initializeCorrectionAccum` -> `applyCorrections` | `solveXPBDConstraints` (Sub-steps) |
| **8. Finalize** | `finalizePhysicsTick` | `finalizePhysicsTick` |

## 4. Leak Audit & Fixes

**Leak Candidate 1: `applyForcePass` (Legacy Forces)**
*   *Current*: Calculates Repulsion, Collision, Gravity, Springs.
*   *Fix*: Do not call in XPBD. Create `applyXPBDExternalForces` (Gravity + User Drag).

**Leak Candidate 2: `integrateNodes`**
*   *Current*: Contains implicit `applyDamping` and `applyCarrierFlow`.
*   *Fix*: Refactor `integrateNodes` to take a `mode` flag or separate `integrateNodesXPBD`.
*   *Short-term*: Use `integrateNodes` but ensure policy disables carrier flow.

**Leak Candidate 3: `finalizePhysicsTick`**
*   *Current*: Updates `lastGoodX`, handles Degrade.
*   *Safe?*: Mostly safe. It records valid state.

**Leak Candidate 4: `interaction.ts` (Drag)**
*   *Current*: Modifies `v` directly.
*   *Safe?*: Yes, user interaction is "God Mode". Matches both.

## 5. Implementation Plan

### A. The Router (`engineTick.ts`)
Refactor `runPhysicsTick` into a switch:

```typescript
export const runPhysicsTick = (engine: PhysicsEngineTickContext, dtIn: number) => {
    if (engine.config.useXPBD) {
        runPhysicsTickXPBD(engine, dtIn);
    } else {
        runPhysicsTickLegacy(engine, dtIn);
    }
}
```

### B. `runPhysicsTickLegacy`
*   Move the *entire current body* of `runPhysicsTick` into this new function.
*   Zero risk of regression for existing mode.

### C. `runPhysicsTickXPBD` (The Clean Room)
*   **Step 1 (Now)**: Skeleton that runs:
    1.  Preflight (Firewall).
    2.  DT Policy.
    3.  `stats` initialization.
    4.  **Integration** (Drag only).
    5.  **Telemetry** (Log "XPBD Active").
    6.  Finalize.
*   **Step 2 (Next Task)**: Fill in the Solver.

### D. Telemetry
Add `engine.mode` to `DebugStats` and HUD.
*   `mode: 'LEGACY' | 'XPBD'`
*   `forbiddenPassCount`: Increment if legacy function called while `useXPBD` is true.

## 6. Verification
1.  Toggle `useXPBD = true`.
2.  Verify graph moves (Drag works) but NO springs/repulsion (Skeleton state).
3.  Verify HUD says "XPBD".
4.  Toggle back. Verify Legacy works exactly as before.
