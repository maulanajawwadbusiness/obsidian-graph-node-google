# Physics Engine X-Ray: Movement & Performance

**Target**: Deep Forensics of Node Movement & Optimization Strategies
**Date**: 2026-01-30

## 1. Top-Level Doctrine: "Visual Dignity" (0-Slush)
The engine prioritizes **1:1 Time Match over Simulation Fidelity**.

*   **Contract**: Use `performance.now()` delta.
*   **Overload Failure Mode**: **Brief Stutter (Drop Debt)**.
    *   If `accumulatorMs` exceeds `maxStepsPerFrame x fixedStep`, we assume we are hopelessly behind.
    *   **Action**: Hard Reset (`accumulatorMs = 0`). The graph teleports to the current time.
    *   **Forbidden**: "Syrup" (slowing time to catch up).
*   **Freeze Protection**:
    *   **Tab Switch**: `dt > 250ms` -> Instant Freeze frame (no simulation).
    *   **Watchdog**: Debt persisting > 2 frames -> Hard Drop.

## 3. The Degrade-1:1 System ("No Mud")
When frame budget (`maxPhysicsBudgetMs`) is exceeded, we do NOT lower spring stiffness (which creates "mud" / weak structure). Instead, we **skip entire passes** explicitly.

### Bucket Strategy
1.  **Bucket A (Sacred)**:
    *   **Integration**: Always runs.
    *   **Interaction**: Dragged node + Neighbors (Local Boost) always get full physics (Level 0 priority).
2.  **Bucket B (Structural)**:
    *   **Springs/Repulsion**: Frequency scales (1/1 -> 1/2 -> 1/3).
    *   **Constraint**: Stiffness constant is normalized by `dt` to remain invariant.
3.  **Bucket C (Luxury)**:
    *   **Far-Field Spacing**: Heavily throttled in Level 2.
    *   **Deep Diffusion**: Neighbor count cap reduces (3 -> 1 -> 0).

## 4. The Hybrid Solver Pipeline
The ticking loop (`src/physics/engine.ts`) execution order:
1.  **Force Pass** (Soft: Repulsion, Springs) -> *Modulate by Degrade Schedule*
2.  **Velocity Pass** (Damping, Drag, Inertia, Local Boost Logic)
3.  **Integration** (Euler) -> *Updates x = x + v*
4.  **Constraints** (PBD via Accumulator) -> *Safety Clamp (Hard) + Spacing (Soft)*
5.  **Correction Diffusion** -> *Smoothes jitter*

## 5. Locality Protection (Interaction Bubble)
User interaction must never feel degraded.
*   **Mechanism**: `Local Boost`.
*   **Trigger**: Dragging a node.
*   **Effect**: The dragged node + its direct neighbors (`focusActive`) are forced into **Level 0** (Full Physics) regardless of the global `degradeLevel`.
*   **Result**: The graph under your finger feels "crisp" and responsive (60hz), while the far-field might be updating at 20-30hz (stuttery but stable).

## 6. Observability
New telemetry in `[RenderPerf]` and `[PhysicsPasses]`:

*   `[RenderPerf]`:
    *   `droppedMs`: >0 means we skipped time to maintain 1:1.
    *   `reason=OVERLOAD/BUDGET`: Why we dropped it.
*   `[Overload]`:
    *   `severity=SOFT/HARD`: Current stress state.
*   `[Degrade]`:
    *   `level=1`: Active skip level.
    *   `passes={repel:Y, space:N}`: What actually ran this frame.
*   `[Hand]`:
    *   `localBoost=Y`: Verifies interaction bubble is protecting the drag.
*   `[Impulse]`: Logs when kicker fires (time `t=...`) or is rejected.
*   `[RenderDrift]`: Logs global angle if micro-drift is active.
