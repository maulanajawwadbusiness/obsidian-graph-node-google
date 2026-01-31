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
The ticking loop (`src/physics/engine/engineTick.ts`) execution order:
1.  **Force Pass** (Soft: Repulsion, Springs) -> *Modulate by Degrade Schedule*
2.  **Velocity Pass** (Damping, Drag, Inertia, Local Boost Logic)
3.  **Integration** (Euler) -> *Updates x = x + v*
4.  **Constraints** (PBD via Accumulator) -> *Safety Clamp (Hard) + Spacing (Soft)*
5.  **Correction Diffusion** -> *Smoothes jitter*

### MotionPolicy (Energy → Ramps)
Energy thresholds are now routed through a unified `MotionPolicy` ramp set (early-expansion, expansion, diffusion, hub relief). This avoids hard law flips and keeps constraint/velocity gating continuous.

## 5. Locality Protection (Interaction Bubble)
User interaction must never feel degraded.
*   **Mechanism 1: Local Boost**:
    *   **Trigger**: Dragging a node.
    *   **Effect**: The dragged node + its direct neighbors (`focusActive`) are forced into **Level 0** (Full Physics).
*   **Mechanism 2: Knife-Sharp Drag**:
    *   **Trigger**: `moveDrag`.
    *   **Start**: **Deferred** (`setPendingDrag`) to render loop to sync with Frame Camera (Fix #36).
    *   **Law Lock**: Dragged nodes are treated as Fixed (infinite mass), bypassing integration.
*   **Determinism & Scaling**:
    *   **Constraint Ordering**: Fixed pipeline (Mouse -> Drag -> Link -> NonOverlap).
    *   **Dt Clamp**: Frame deltas capped at 32ms (max 2 substeps) to prevent "spiral of death".
    *   **Idle Mode**: Debt is aggressively shed (dropped) during idle to ensure instant "wake up" without catch-up lag.

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
    *   **Pixel Alignment (Hysteresis)**: Motion is smooth (float), Rest is crisp (integer snapped). 150ms settling period.
    *   **Overlay Glue** (New): Popup positions are locked to the render loop via `graph-render-tick` event (Zero Lag).
    *   **Decoupled Input**: `useGraphRendering` samples pointers but applies them in `rAF` using the **Frame Camera** (Fix 34).
    *   **Deterministic Plan**: `UpdatePlan` calculated at frame start freezes laws/budgets for the tick (Fix 35).
    *   **Surface Safety**: `DPR` logic contains 4-frame hysteresis (Fix 41).

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
*   **Physics HUD (Debug Panel)**: 
    *   **2-Column Layout**: Left (Summary/Controls) | Right (Ledgers).
    *   **Energy Ledger**: Real-time v² breakdown per stage (Input, Spring, Repulse, Constrain) to find energy leaks.
    *   **Fight Ledger**: Conflict% and correction mag per constraint stage.
*   **Feel Markers (Debug Panel)**: Dev-only canvas markers show rest state (cyan/amber) and conflict halos per dot.
