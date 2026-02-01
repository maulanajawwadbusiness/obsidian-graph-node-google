# Forensic Report: Mode Isolation (Hybrid Core vs XPBD Core)
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** PROOF-CARRYING (Implemented)

## 1. Goal: Knife-Sharp Isolation
To prevent "Hybrid Accidents" (e.g., legacy velocity heuristics fighting XPBD compliance constraints), we have strictly separated the execution pipelines.

*   **Legacy Mode**: The current heuristic-heavy, PBD-lite engine.
*   **XPBD Mode**: A clean, physical simulation based on Extended Position-Based Dynamics.

**Rule**: A single frame must NEVER run passes from both modes.
**Enforcement**: Runtime Tripwire (`assertMode`) latches leaks and reports to HUD.

## 2. Concrete Call Graph & Forbidden Passes

### A. The Router (`engineTick.ts`)
The `runPhysicsTick` function is now a pure router:
```typescript
export const runPhysicsTick = (engine: PhysicsEngineTickContext, dtIn: number) => {
    if (engine.config.useXPBD) {
        runPhysicsTickXPBD(engine, dtIn);
    } else {
        runPhysicsTickLegacy(engine, dtIn);
    }
};
```

### B. Legacy Pipeline & Forbidden Wrappers
The `runPhysicsTickLegacy` path executes the original logic. We have wrapped critical legacy passes with `assertMode(engine, stats, 'PassName')`.

| Step | Function | Callsite (File:Line) | Read/Write | Status in XPBD | Tripwire Active? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Forces** | `applyForcePass` | `engineTick.ts:636` | Reads: x,y<br>Writes: fx,fy | **FORBIDDEN** | [x] Yes |
| **Integration** | `integrateNodes` | `engineTick.ts:678` | Reads: fx,fy,x,v<br>Writes: x,v | **HYBRID** (Flagged) | [x] Gated by param |
| **MicroSlip** | `applyDenseCoreVelocityDeLocking` | `engineTick.ts:696` | Writes: vx,vy | **FORBIDDEN** | [x] Yes |
| **Friction** | `applyStaticFrictionBypass` | `engineTick.ts:700` | Writes: vx,vy | **FORBIDDEN** | [x] Yes |
| **Decoherence** | `applyAngularVelocityDecoherence` | `engineTick.ts:704` | Writes: vx,vy | **FORBIDDEN** | [x] Yes |
| **Diffusion** | `applyLocalPhaseDiffusion` | `engineTick.ts:708` | Writes: vx,vy | **FORBIDDEN** | [x] Yes |
| **Escape** | `applyEdgeShearStagnationEscape` | `engineTick.ts:712` | Writes: vx,vy | **FORBIDDEN** | [x] Yes |
| **Inertia** | `applyDenseCoreInertiaRelaxation` | `engineTick.ts:716` | Writes: vx,vy | **FORBIDDEN** | [x] Yes |
| **Relaxation** | `applyEdgeRelaxation` | `engineTick.ts:735` | Writes: Position Accum | **FORBIDDEN** | [x] Yes |
| **Spacing** | `applySpacingConstraints` | `engineTick.ts:741` | Writes: Position Accum | **FORBIDDEN** | [x] Yes |
| **Solver** | `applyCorrectionsWithDiffusion` | `engineTick.ts:852` | Writes: x,y, prevX | **FORBIDDEN** | [x] Yes |

### C. XPBD Pipeline (Clean Room)
`engineTickXPBD.ts` is a clean implementation that calls:
1. `runTickPreflight` (Shared)
2. `applyDragVelocity` (Shared, valid Physics)
3. `integrateNodes(..., useXPBD=true)` (Shared, stripped of V-Mods)
4. *Pending Solver*
5. `finalizePhysicsTick` (Shared)

## 3. `integrateNodes` Truth

`integrateNodes` in `integration.ts` has been refactored to accept `useXPBD: boolean`.

**Side Effect Enumeration:**
1.  **Global Spin/Drift**: Clean Physics (Drag/Rotation). *Allowed.*
2.  **Base Integration**: `x += v * dt`. *Allowed.*
3.  **Damping**: `v *= damping`. *Allowed.*
4.  **Carrier Flow (`applyCarrierFlowAndPersistence`)**: **FORBIDDEN LEAK**.
    *   *Fix*: Gated inside `if (!useXPBD)`.
5.  **Hub Velocity Scaling (`applyHubVelocityScaling`)**: **FORBIDDEN LEAK**.
    *   *Fix*: Gated inside `if (!useXPBD)`.
6.  **Velocity Clamping**: Safety feature. *Allowed.*
7.  **Sleep Logic**: Safety feature. *Allowed.*

## 4. Leak Tripwire Implementation

**Mechanism**:
*   `DebugStats` now tracks: `forbiddenPassCount`, `forbiddenLeakLatched`, `forbiddenPassLast`.
*   `assertMode(engine, stats, passName)`: Checks `engine.config.useXPBD`. If true, increments counter, sets latch, and logs error.

**Visibility**:
*   HUD now displays `Mode: XPBD` vs `LEGACY`.
*   HUD displays `forbiddenPassCount` if > 0.

## 5. Verification Status
*   **Leak Test**: To verify, one could temporarily call `applySpacingConstraints` in `engineTickXPBD.ts`. Result would be immediate red flags in HUD.
*   **Isolation**: Confirmed by code audit. XPBD tick path contains zero calls to legacy constraints functions.

**Next Steps**: Implement the XPBD Solver (Gauss-Seidel) in the `TODO` block of `engineTickXPBD.ts`.
