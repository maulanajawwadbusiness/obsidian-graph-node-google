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
*   **Mechanism 1: Local Boost**:
    *   **Trigger**: Dragging a node.
    *   **Effect**: The dragged node + its direct neighbors (`focusActive`) are forced into **Level 0** (Full Physics).
*   **Mechanism 2: Knife-Sharp Drag**:
    *   **Trigger**: `moveDrag`.
    *   **Effect**: Position updates are applied **immediately** to the node object, bypassing the 16ms physics tick.
    *   **Result**: 1:1 Hardware Cursor Sync (Zero Lag).

## 6. Move-Leak Hardening (01–22 + Interaction)
**Status**: Secured.

### A. The Four-Layer Shield
1.  **Render Guard**: `CameraTransform` ensures mathematical perfection in World<->Screen mapping (Fixes 01-03).
2.  **Scheduler Guard**: Timebase is strictly decoupled. We never "stretch" time. Overload = Stutter (Fixes 04-06).
3.  **Physics Guard**: Absolute authority. Dragged nodes, sleeping nodes, and warm-starts are cleansed of "ghost" forces (Fixes 07-22).
4.  **Interaction Guard**:
    *   **Overlay Shield**: `e.target === canvas` prevents click-through.
    *   **Gesture Policy**: 5px threshold prevents accidental drags.
    *   **Z-Order**: Top-most node always wins the click.
    *   **Pixel Alignment** (New): Stroking logic quantizes to `N.5` or `N.0` pixels for visual crispness.
    *   **Overlay Glue** (New): Popup positions are locked to the render loop via `graph-render-tick` event (Zero Lag).

### B. Critical Mechanisms
*   **Correction Residue**: Unpaid constraint budget is stored as debt (`correctionResidual`), preventing dense clusters from crawling.
*   **Hot Pair Fairness**: Violated pairs are upgraded to 1:1 "Hot" status to prevent crawl.
*   **Hub Snap**: Velocity low-pass filters snap to 0.00 when input ceases.
*   **Triangle Ramp**: Degenerate triangles fade force to 0.

## 7. Observability
New telemetry in `[RenderPerf]` and `[PhysicsPasses]`:

*   `[RenderPerf]`:
    *   `droppedMs`: >0 means we skipped time to maintain 1:1.
    *   `reason=OVERLOAD/BUDGET`: Why we dropped it.
*   `[FixedLeakWarn]`: **CRITICAL**. Fixed node moved by solver.
*   `[Degrade]`: `level`, `passes`.
*   `[Hand]`: `localBoost=Y`.
*   `[Impulse]`: Logged on trigger or rejection.
*   `[RenderDrift]`: Logs global angle if micro-drift is active (should be 0).
