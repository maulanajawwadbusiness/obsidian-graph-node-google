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
    *   **Integration**: `integration.ts` (Verlet with `timePolicy`)
    *   **Stagnation Escape**:
        *   `velocity/lowForceStagnationEscape.ts` (Constraint-Aware Drift)
        *   `velocity/edgeShearStagnationEscape.ts` (Constraint-Aware Shear)
        *   `velocity/staticFrictionBypass.ts` (Heartbeat-Protected Micro-Slip)
    *   **Utilities**:
        *   `random.ts` (Deterministic Pseudo-Random Generator)
        *   `stats.ts` (Telemetry & Loop Detection) full physics (Level 0 priority).
2.  **Bucket B (Structural)**:
    *   **Springs/Repulsion**: Frequency scales (1/1 -> 1/2 -> 1/3).
    *   **Constraint**: Stiffness constant is normalized by `dt` to remain invariant.
3.  **Bucket C (Luxury)**:
    *   **Far-Field Spacing**: Heavily throttled in Level 2.
    *   **Deep Diffusion**: Neighbor count cap reduces (3 -> 1 -> 0).

## 4. The Hybrid Solver Pipeline
The ticking loop (`src/physics/engine/engineTick.ts`) execution order:
1.  **Ticket Preflight**: Firewall checks (NaN/Inf) and Hub/StuckScore analysis.
2.  **MotionPolicy**: Computes global temperature and degrade scalars.
3.  **Force Pass** (Soft: Repulsion, Springs) -> *includes Deterministic Singularity Handling*
4.  **Velocity Pass** (Damping, Drag, Inertia, Local Boost Logic)
5.  **Integration** (Euler) -> *Updates x = x + v*
6.  **Constraints** (PBD via Accumulator) -> *Safety Clamp + Gentle Overlap Resolver ($d < 0.1$)*
7.  **Correction Diffusion** -> *Smoothes jitter*

### MotionPolicy (Energy → Ramps)
Energy thresholds are now routed through a unified `MotionPolicy` ramp set (early-expansion, expansion, diffusion, hub relief). Note: Start-only ramps (like Carrier Flow) are **disabled** under the `spread` init strategy.

## 4.1 Initialization Strategy (No Explosion Start)
The default init strategy is now **`spread`**, which seeds dots in a wide, deterministic spiral/disc with a minimum separation epsilon. This removes the need for pre-roll or impulse kicks while still preventing true `distance=0` singularities. Use `initStrategy: "legacy"` only when you explicitly want the previous pre-roll/impulse behavior.

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
    ### 6. Rest & Settle (Truthful)
    - **Concept**: Adaptive thresholds with confidence-based hysteresis.
    - **Logic**:
        - `isSafeToSleep`: Speed < 0.05, Pressure < 0.25.
        - `settleConfidence`: EMA tracking global calm % (Target 95%).
        - **Ladder**: Moving -> Cooling (Conf>0.5) -> Sleep (Conf>0.95).
    - **Files**: `engineTick.ts` (State Machine), `physicsHud.ts` (Diagnostics).
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

### C. 2026-02-01 Hardening (Determinism & Rest)
*   **Micro-Slip Heartbeat**: Replaced simple velocity check with `StuckScore` (Pressure + Low Speed) and 1.0s cooldown to prevent active vibration (Fix #44).
*   **Determinism**: All `Math.random` replaced with seeded `pseudoRandom`. Simulation is now bit-exact reproducible on Reset.
*   **Rest Truth**: Sleep requires global calm (95% nodes < speed threshold) for >10 frames (`idleFrames`).
*   **Constraint-Aware Escape**: Stagnation escape currents check `dot(Force, Constraint)` to avoid fighting PBD.
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

## 8. Cross-Browser Determinism (Bit-Exact)
To ensure reliable replication of bugs and identical layouts across engines:
1.  **Stable Sets**: All constraint sets (`hotPairs`) are sorted before iteration.
2.  **Numeric Rebase**:
    *   **Local**: Calm nodes snap `v` to `0.0`.
    *   **Global**: World shifts to centroid if `maxPos > 50,000` to prevent float precision loss. Triggers `onWorldShift` callback for camera sync.
3.  **Checksum**: HUD shows `chk: [HEX]` hash of quantized positions.
4.  **Pseudo-Random**: All physics fallbacks (overlap, zero-length springs) use `engine.pseudoRandom(idA, idB)` for consistent resolution direction.

## 9. Performance Scale (N-Invariant Law)
To ensure "Single Continuous Law" feeling across N=10 to N=1000:
1.  **Triangle Cache**: O(N^3) scans are only run on topology add/remove. `constraints.ts` uses cached list.
2.  **Shared Density**: `localDensity` is computed once per tick (O(N^2)) and shared with all injectors (`lowForce`, `edgeShear`, `forces`).
3.  **Hot Pair Hygiene**: Dead keys are pruned instantly from `hotPairs` to prevent leak accumulation.
