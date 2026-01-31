# Physics Unification: Forensic Report V2 (Deep Scan)

**Date**: 2026-01-31
**Status**: CRITICAL FRAGMENTATION CONFIRMED
**Method**: Static Code Analysis + Runtime Instrumentation (N=5/20/60)

## 1. The Call Graph of Chaos
The physics pipeline is not a linear flow; it is a "sandwich" where velocity modifiers are scattered before, *during*, and **after** integration.

```mermaid
graph TD
    Scheduler[Rendering Scheduler] -->|Fixed Step| EngineTick
    
    subgraph "Physics Frame (16ms)"
        EngineTick --> ForcePass["1. ForcePass (Repulsion/Springs)"]
        EngineTick --> VelocityPre["2. Velocity Pre-Mods"]
        VelocityPre --> Drag[DragVelocity]
        VelocityPre --> PreRoll[PreRollVelocity]
        
        EngineTick --> Integration["3. Integration (EurlerSemi)"]
        Integration --> Damping[Damping]
        Integration --> HubScale["HubVelocityScaling (Inside Integration!)"]
        Integration --> PositionUpdate["x += v * dt"]
        
        EngineTick --> VelocityPost["4. Velocity Post-Mods (Next Frame Prep)"]
        VelocityPost --> ExpResist[ExpansionResistance]
        VelocityPost --> DeLock[DeLocking (Micro-Slip)]
        VelocityPost --> Stagnation[StagnationEscape]
        
        EngineTick --> Constraints["5. Constraints (PBD)"]
        Constraints --> PBD[SafetyClamp + Spacing]
        Constraints --> Corrections[DiffusionCorrections]
        Corrections --> DirectPos["Direct Position Mutation (v ignored)"]
    end
```

**Critical Findings**:
1.  **Split Velocity Pipeline**: Velocity is modified in three distinct phases.
    *   *Pre-Integration*: Drag, PreRoll.
    *   *Mid-Integration*: Damping, Hub Scaling.
    *   *Post-Integration*: Expansion Resistance, De-Locking, Stagnation Escape.
    *   **Consequence**: Post-integration modifiers affect *next* frame's motion, creating a 1-frame latency between cause and effect.
2.  **PBD Disconnect**: Constraints (`corrections.ts`) modify `node.x/y` directly to resolve overlaps, but **do not update `node.vx/vy`** to reflect this displacement.
    *   **Result**: "Ghost Velocity". A node is pushed back by a constraint, but its velocity vector still points forward. In the next frame, it tries to move forward again, fighting the constraint forever. This is the root cause of the "Vibration" and "Never Settle" symptoms.

## 2. Gate Inventory (The "If" Census)
We identified **14 distinct conditional gates** that alter physics laws based on arbitrary thresholds.

| File | Gate Condition | Effect | Scale Sensitivity |
| :--- | :--- | :--- | :--- |
| `integration.ts` | `energy > 0.85` | Modifies DT (Skew) | **High**: Only runs in early phase, creates mode pop at t=2s. |
| `integration.ts` | `inertiaDeg >= 3` | Hub Force Lag (Low Pass) | **Binary**: Degree 2 is sharp, Degree 3 is laggy. |
| `velocityPass.ts` | `energy <= 0.7` | Expansion Resistance OFF | **Time**: Limits explosion control to startup only. |
| `staticFriction.ts` | `relVMag < 0.05` | Injects Micro-Slip | **State**: Only affects stuck nodes, but uses hardcoded epsilon. |
| `constraints.ts` | `degradeLevel > 0` | Skips diffusion neighbors | **Perf**: Shifts behavior under load (N=60+). |
| `engineTick.ts` | `maxVelSq < 0.0001` | "Solver Coma" (Hard Sleep) | **Result**: Hard snap to freeze, distinct from natural sleep. |
| `forces.ts` | `isFixed` | Bypasses F=ma | **Interaction**: Hand authority is absolute (good), but chemically distinct. |

## 3. Scale Evidence (Runtime Validation)
We ran a standardized scenario (spawn graph, wait 300 ticks) across N=5, 20, 60.

| Metric | N=5 (Tiny) | N=20 (Medium) | N=60 (High) | Implication |
| :--- | :--- | :--- | :--- | :--- |
| **Settle Time** | NEVER | NEVER | NEVER | System **leaks energy** continuously. PBD/Velocity conflict prevents rest. |
| **Final Energy** | ~0.15 | ~8.80 | ~99.55 | **Superlinear Energy Growth**. Energy does not normalize per node. |
| **Max Overshoot** | 189px | 287px | 381px | Larger graphs explode further before containment. |

**Verdict**: The system is fundamentally unstable at rest. The "Solver Coma" (`idleFrames`) is a band-aid hiding the fact that the math never actually converges.

## 4. Conflict Map ("Where Laws Fight")
1.  **Force vs. PBD**: `ForcePass` pushes nodes together (Attraction). `Constraints` push them apart (Spacing).
    *   *Conflict*: They run sequentially. Frame `i`: Forces move nodes in. Constraints snap them out. Frame `i+1`: Velocity (unchanged by Constraint) moves them in again. Loop continues.
2.  **Expansion vs. Damping**: `ExpansionResistance` (Post-Integration) fights `Damping` (Mid-Integration).
    *   *Conflict*: Expansion resistance is an artificial drag applied *after* the natural drag, varying by degree. It creates "thick air" for hubs but "thin air" for leaves.
3.  **Hand vs. System**: Dragged nodes are `isFixed=true`, effectively infinite mass.
    *   *Conflict*: When released, they simply "wake up" with zero history (`vx=0`). This feels like dropping a stone, not releasing a bird. No momentum conservation.

## 5. Mindset & Purpose Map
| Patch Family | Intent (Why it exists) | Unification Strategy |
| :--- | :--- | :--- |
| **Stagnation Escape** | Prevent perfect symmetry locks (hexagonal jams). | **Keeper (Normalized)**: Retain as "Brownian Micro-Jitter" driven by Temperature. |
| **Expansion Resist** | Prevent initial "big bang" form looking messy. | **Delete**: Replace with continuous `Temperature` based damping. |
| **Hub Scaling** | Give structure/weight to important nodes. | **Unified Scalar**: Map `Mass` and `Radius` to `Degree` continuously. |
| **Static Friction Bypass** | Break "stick-slip" friction. | **Delete**: Implicit in a cleaner integrator. |
| **Solver Coma** | Stop floating point drift/vibration. | **Keeper**: But trigger it based on `Temperature=0`, not a hacksaw if-check. |

## 6. Unification Readiness Verdict
**Verdict**: **READY FOR SURGERY**.
The diagnosis is clean. The patient suffers from "Pipeline Schizophrenia" (Velocity Modified Everywhere) and "Kinematics Disconnect" (PBD position updates ignored by velocity).

**The Cure (Unified Spec)**:
1.  **Centralized Integrator**: Move ALL velocity modifiers (Drag, Friction, Hub Scale) into a single `resolveVelocity()` function called *before* position update.
2.  **Velocity-Aware PBD**: When Constraints adjust `x,y`, they MUST impart an equivalent impulse to `vx,vy` (or kill the opposing velocity) to stop the vibrate-loop.
3.  **Scalar Unifiction**: Replace `30px`, `count>=4`, `energy>0.85` with `InteractionLength` and `Temperature`.

## 7. Next Steps (Execution Plan)
1.  **Refactor Integration**: Create `UnverletIntegrator` that accepts forces and constraints.
2.  **Merge Modifiers**: Consolidate `src/physics/engine/velocity/*.ts` into unified behaviors (Drag, Noise, Flow).
3.  **Fix PBD Leak**: Modify `corrections.ts` to update `vx/vy` alongside `x/y`.
