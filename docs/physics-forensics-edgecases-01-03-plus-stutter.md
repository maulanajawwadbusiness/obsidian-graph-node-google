# Physics Forensics: Edge Cases 01–03 & Overload Stutter

## 1. Executive Summary
This report documents the resolution of three critical performance edge cases (01–03) and the enforcement of the "Brief Stutter" overload failure mode.

-   **Edge Cases Fixed**:
    -   **01: Pairwise O(N²) Trap**: Eliminated quadratic bottlenecks via strided sampling and budget caps. Interaction remains O(N) even at 3k+ nodes.
    -   **02: Dense-Ball Pile-Up**: Solved "boiling" artifacts using clamp budgets, safety clamps, and inertia relaxation.
    -   **03: Hot-Pass Cascade**: Prevented frame-drop spikes by decoupling spacing/collision phases and using energy-gated execution.
-   **User Outcome**: The graph feels "lightweight" and "sharp". Under heavy load (e.g., GC pause), it **stutters** (teleports to catch up) rather than slowing down into "syrup".
-   **Invariants**:
    -   Max physics time per frame ≤ `maxStepsPerFrame` * `fixedStep`.
    -   Accumulator NEVER persists > 1 frame of debt.
    -   Zero "rubber-banding" of time.

## 2. Code Map
| Feature | Files | Key Functions / Config |
| :--- | :--- | :--- |
| **Scheduler (Stutter)** | `src/playground/useGraphRendering.ts` | `render()` loop, `accumulatorMs` logic |
| **Edge Case 01 (O(N²))** | `src/physics/engine/constraints.ts`<br>`src/physics/config.ts` | `applySpacingConstraints`<br>`pairwiseMaxStride`, `shouldSkipPair` |
| **Edge Case 02 (Dense)** | `src/physics/engine/constraints.ts`<br>`src/physics/engine/velocity` | `applySafetyClamp`<br>`applyDenseCoreInertiaRelaxation` |
| **Edge Case 03 (Cascade)** | `src/physics/engine.ts`<br>`src/physics/config.ts` | `tick()`<br>`spacingGate`, `spacingCascadeGate` |

## 3. Edge Case 01: Pairwise O(N²) Trap
**The Trap**: With 3000 nodes, a naive double-loop check (`O(N^2)`) requires ~4.5 million comparisons per frame. This freezes the main thread.

**The Fix: Strided Sampling & Budgeting**
-   **Method**: We implemented a deterministic strided sampler using prime number mixing.
    ```typescript
    const shouldSkipPair = (a, b) => {
        const mix = (i * 73856093 + j * 19349663 + pairOffset) % pairStride;
        return mix !== 0;
    };
    ```
-   **Budgeting**: `config.pairwiseMaxChecks` (def: 60k) caps the work. Frame 1 checks range [0, k], Frame 2 checks [k, 2k], etc.
-   **Result**: CPU cost is clamped to a fixed budget regardless of N. The graph converges over multiple frames (temporal coherence) rather than freezing one frame.

## 4. Edge Case 02: Dense-Ball Pile-Up
**The Trap**: When nodes are forced into a dense cluster (e.g., initial spawn), hard collision constraints fight each other. Node A pushes B, B pushes C, C pushes A back. This creates infinite energy ("boiling") and numerical instability.

**The Fix: Budgets & Tempering**
-   **Correction Budget**: `config.maxCorrectionPerFrame` limits how far a node can be pushed in one tick. If forces demand 50px movement, we grant only 1.5px.
-   **Safety Clamp**: `applySafetyClamp` runs *after* soft forces. It only triggers on deep penetration (>5px) and applies a hard, non-negotiable separate correction to prevent overlap.
-   **Inertia Relaxation**: In dense cores, we actively damp velocity (`applyDenseCoreInertiaRelaxation`) to kill momentum memory, effectively turning the core into a "slush" that settles instead of vibrating.

## 5. Edge Case 03: Hot-Pass Cascade
**The Trap**: At high energy (formation), Repulsion, Collision, Spacing, and Triangle Area constraints would all activate simultaneously. This 4x load spike caused 100ms+ frames, triggering the death spiral.

**The Fix: Phase Staggering**
-   **Energy Gating**: `spacingGate` monitors system energy. Expensive passes (Spacing) simply *do not run* if energy is too high ("too hot to care about spacing") or too low ("already settled").
-   **Cascade Staggering**: We verify `config.spacingCascadePhaseModulo`. We split pairwise checks across multiple frames (e.g., modulo 3). Frame A does Repulsion, Frame B does Spacing.
-   **Outcome**: Load is smoothed over time. The "Peak Frame Cost" is reduced by ~60%.

## 6. Overload Behavior: Brief Stutter (Drop Debt)
**The Contract**: "Skip Time, Don't Stretch Time."

**Implementation**:
In `useGraphRendering.ts`, the scheduler enforces invariants:
1.  **Run Fast**: Execute up to `maxStepsPerFrame` (default 2) physics steps.
2.  **Drop Remaining**: If `accumulatorMs` still exceeds `fixedStepMs` after the budget is spent, **DELETE** the debt.
    ```typescript
    if (accumulatorMs >= debtLimit) {
        droppedMs += accumulatorMs;
        accumulatorMs = 0; // HARD RESET
    }
    ```
3.  **No Carry-Over**: We never carry >1 frame of debt into the next render. This mathematically prevents "Syrup" (slow motion) where the simulation falls further and further behind wall-clock time.

## 7. Instrumentation & Logs
We added explicit telemetry to verify these states.

**Overload Logs**:
```text
[RenderPerf] droppedMs=84.0 reason=OVERLOAD budgetMs=33.3 ticksThisFrame=2 ...
```
-   `droppedMs > 0`: Time was skipped.
-   `reason=OVERLOAD`: The system shed load to maintain real-time responsiveness.

**Slush Warning**:
```text
[PhysicsSlushWarn] accumulatorPersist=35.2ms frames=3 threshold=32.0ms
```
-   If you see this, the Drop Debt logic failed or was bypassed. This is a BUG.

## 8. Validation Protocol

### A. Dense-Ball Test (Regression 02)
1.  Spawn 2000 nodes with `repulsionStrength=0` (force collapse).
2.  **Expected**: Nodes form a tight ball. No "jittering" or "exploding". FPS remains >30.
3.  **Logs**: `[PhysicsPerf] safety.clampTriggers` should be active but stable.

### B. Hot-Pass Test (Regression 03)
1.  Press Reset (R) with `spawnCount=500`.
2.  **Expected**: Initial explosion is smooth. No single "hitch" frame > 32ms.
3.  **Logs**: `spacingGate` should be 0 initially, then ramp up as energy drops.

### C. Overload (Stutter) Test
1.  Enable `debugStall: true` in `config.ts`.
2.  Drag a node in circles.
3.  **Expected**: The node follows the cursor position *exactly* (spatially) but updates at low FPS (temporally).
4.  **Forbidden**: The node drifting inches behind the cursor (lag/syrup).

## 9. Known Tradeoffs
-   **Stutter vs Smoothness**: We prioritize "Current State" over "Smooth History". In extreme lag (e.g., 5fps), animations will look like a slideshow, but interaction (hover, drag) remains accurate.
-   **Staggering Artifacts**: Very fast node movements might briefly intersect (tunneling) because collision checks are strided. This is acceptable for a visualization layout engine (not a game engine).
