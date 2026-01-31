# Physics Unification: Forensic Report V3 (Missing Truths)

**Date**: 2026-01-31
**Status**: COMPLETE DIAGNOSIS
**Scope**: Energy Leaks, PBD Conflicts, Gate Inventory, Settle Ladder

## 1. Executive Summary: The "Ghost Velocity" Engine
The V3 scan confirms that the simulation fails to settle because **Position Based Dynamics (PBD) moves nodes (up to 5.6px/frame at N=60) without updating their velocity**. This creates a permanent disconnect between "where I am" and "where I'm going".

Coupled with **3 distinct Energy Injector** mechanisms that artificially pump velocity when things try to stop, the system is chemically incapable of rest.

## 2. Evidence: The Scale Table (Runtime Data)
Instrumented capture of 300 ticks (5 seconds).

| Metric | N=5 (Tiny) | N=20 (Medium) | N=60 (High) | Diagnosis |
| :--- | :--- | :--- | :--- | :--- |
| **Settle Time** | NEVER | NEVER | NEVER | System leaks energy at all scales. |
| **Final Energy** | 0.11 | 2.69 | **99.55** | Superlinear growth. N=60 is a boiling pot. |
| **PBD Disp/Frame** | 0.28 px | 1.34 px | **5.65 px** | **CRITICAL**. At N=60, nodes are "teleported" ~340px/sec by constraints. |
| **Conflict Ratio** | 32.0% | 19.1% | 8.4% | % of corrections fighting velocity. Low % at N=60 means PBD is *pumping* motion (surfing). |

## 3. The Energy Injector Census (Motion Sources)
Who is adding energy to the system?

| Injector Name | File | Trigger Condition | Magnitude | Diagnosis |
| :--- | :--- | :--- | :--- | :--- |
| **Static Friction Bypass** | `staticFrictionBypass.ts` | `energy>0.85` & `relVel<0.05` & Dense | `0.01` px/frame | **Artificial Noise**. Explicitly adds velocity to break static pairs. Distinct from temperature. |
| **Edge Shear Escape** | `edgeShearStagnationEscape.ts` | `energy>0.85` & `tension<5px` & `relVel<0.3` | `0.03 * stuckness` | **Unlocker**. Perpendicular kick for jammed edges. Necessary but should be temperature-driven. |
| **PBD "Ghost Boost"** | `corrections.ts` | Always (Implicit) | `5.65` px/frame (N=60) | **The Main Leak**. Teleporting nodes changes `F=kx` spring tension immediately, creating new force from thin air without paying kinetic cost. |

## 4. PBD Mutation Census (The "V-Ignorers")
Where exactly is `node.x/y` mutated without touching `node.vx/vy`?

| Component | File | Method | Frequency |
| :--- | :--- | :--- | :--- |
| **Edge Relaxation** | `constraints.ts` | `applyEdgeRelaxation` | Every 1-3 frames |
| **Spacing** | `constraints.ts` | `applySpacingConstraints` | **Heavy**. Cascaded frequency. |
| **Triangle Area** | `constraints.ts` | `applyTriangleAreaConstraints` | Low frequency. |
| **Safety Clamp** | `constraints.ts` | `applySafetyClamp` | Emergency only (>5px overlap). |
| **Diffusion** | `corrections.ts` | `applyCorrectionsWithDiffusion` | **Finalizer**. Summarizes all above. |

**Impact**: All these modify position. None update velocity. The standard "Unverlet" correction pattern (`v += correction / dt`) is missing.

## 5. The Settle Ladder (State Transitions)
The system has four distinct "rest" states, often fighting each other.

1.  **Micro-Drift** (Alive): `integration.ts`. Adds `sin(t)` global rotation if `energy > 0.05`.
    *   *Bug*: This is an infinite energy source if enabled.
2.  **Newtonian Motion**: Standard `v += a * dt`.
3.  **Sleep (Individual)**: `integration.ts`.
    *   *Trigger*: `v < sleepThresh` AND `f < 1%` AND `pressure < 0.01` for 30 frames.
    *   *Effect*: `v=0`.
4.  **Solver Coma (Global)**: `engineTick.ts`.
    *   *Trigger*: `maxVelSq < 0.0001` globally for 60 frames.
    *   *Effect*: HARD EXIT loop.
    *   *Outcome*: This is the only reason the graph ever visually stops. It's a "kill switch", not physics.

## 6. Gate Inventory (The "If" Census)
Scale-dependent logic branches identified.

| Gate | Var | Threshold | Effect | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Expansion Phase** | `energy` | `> 0.85` | Enabled Hub Lag, DT Skew, Injectors | **Delete**. Replce with `Temperature`. |
| **Density Check** | `count` | `radius=30, n>=4` | Enables Solvers | **Continuous**. Use `localDensity` scalar. |
| **Hub Definition** | `degree` | `>= 3` | Hub Mass, Lag, Priority | **Continuous**. Scale mass by degree linearly. |
| **Sleep Pressure** | `correction` | `< 0.01` | Allows Sleep | **Keep**. Good stability gauge. |
| **Drift Gate** | `energy` | `> 0.05` | Micro-Drift | **Link to Temperature**. |

## 7. Hand Release Analysis
**Current Behavior**: 
In `engine.ts` -> `releaseNode()`:
```typescript
node.vx = 0; node.vy = 0; node.fx = 0;
```
**Effect**: "Dropping a stone". History is erased. This prevents "flinging".
**Unification Goal**: We want to preserve `vx/vy` (throw capability) but apply heavy damping *immediately* after release to prevent orbit. The current implementation is safe but boring.

## 8. Unification Risk Register
| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| **Explosion** | High | PBD-to-Velocity feedback `v += dx/dt` can add massive energy if constraints snap hard. **Must dampen corrections**. |
| **Jams** | Medium | Removing "Injectors" (StaticFrictionBypass) might leave hex-locks. **Replace with Temperature Brownian motion**. |
| **Stiffness** | Low | Merging `Triangle` and `Edge` constraints might change "cloth feel". **Tune weights**. |

## 9. Next Steps
1.  **Unified Integrator**: Create `UnverletIntegrator` capable of accepting `dx` and updating `v`.
2.  **Velocity Coupling**: Wire `corrections.ts` output into `node.vx/vy` update.
3.  **Injector Purge**: Remove `staticFrictionBypass` and `edgeShear`. Replace with `Temperature` noise.
