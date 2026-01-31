# Rest Marker Predicate Forensics Report

## 1. Velocity Source Verification
**Finding**: CONFIRMED
*   **Source**: `PhysicsEngine.tick` (in `src/physics/engine.ts`) updates `node.vx` / `node.vy`.
*   **Consumer**: `graphDraw.ts` reads `node.vx` / `node.vy` directly from the same object reference.
*   **No Cache**: There is no intermediate "render velocity" cache or buffer that could be stale. The renderer reads the live physics state.

## 2. Flag Wiring Verification
**Finding**: CONFIRMED
*   `showRestMarkers` is passed from `GraphPhysicsPlayground` state -> `CanvasOverlays` (UI) and `useGraphRendering` (Render Loop).
*   In `useGraphRendering.ts`, it is assigned to `settingsRef.current.showRestMarkers`.
*   In `graphDraw.ts`, `isDebugEnabled(settingsRef.current.showRestMarkers)` gates the drawing block.

## 3. HUD Interpretation Guide

I have instrumented the code to expose the **Predicate Truth Table** in the Rest Marker Forensic HUD. Here is how to interpret the numbers you see on screen:

### The Predicate Table (A / B / C / D)
The marker is drawn if `A || B || C || D` is true.

*   **A (HudSleep)**: Count of nodes where `engine.hudSettleState === 'sleep'`.
    *   *If 0*: The engine is not declaring a global sleep state. This is expected if even one node is moving.
*   **B (IsSleep)**: Count of nodes where `node.isSleeping === true`.
    *   *If 0*: No individual nodes have satisfied the 1-second rest timer (`sleepFrames >= 60`).
*   **C (Frames)**: Count of nodes where `node.sleepFrames > 0`.
    *   *If 0*: No nodes are traversing the "sleep candidate" phase. This implies `speedSq >= restSpeedSq` for everyone (too fast to sleep).
*   **D (Fallback)**: Count of nodes where `speedSq < jitterWarnSq`.
    *   *If 0*: This is the smoking gun. It means **all nodes are moving faster than the jitter threshold (0.000625)**.

### Speed Sanity Check
Check the **SpeedSq Range** and **SampleNode** lines:

*   **SpeedSq Range**: `[Min, Max]`
    *   If `Min > 0.000625` (approx `6e-4`), then **Physics is Too Hot**. The fallback (D) will never trigger.
    *   *Possible Cause*: Micro-jitter, floating point noise, or forces never fully settling (e.g., repulsion singularity).
    *   *Action*: Increase `jitterWarnSq` threshold OR check why physics never settles (damping issue?).

*   **NaN Speeds**:
    *   If `> 0`, the physics simulation has exploded (NaN virus). Restart/Reload.

### Sample Node Data
Shows the raw values for the first node in the list.
*   **Vx/Vy**: Should be tiny (e.g., `0.0001`) effectively zero.
*   **SpeedSq**: The square magnitude. Compare this mentally to `VelocitySleepThreshold^2` (approx `1e-4`).

## Recommended Action Strategy

1.  **If D=0 and MinSpeedSq is high**:
    *   The issue is **Physics Stability**. Nodes are vibrating.
    *   *Fix*: Decrease timestep, increase damping, or increase the sleep thresholds (`MotionPolicy`).

2.  **If D>0 but Candidates=0**:
    *   This is mathematically impossible with the current logic `restCandidate = ... || termD`. If `countD > 0`, then `candidateCount` must be `> 0`.
    *   If this actually happens, there is a JS runtime anomaly or variable shadowing.

3.  **If Candidates>0 but Markers Invisible**:
    *   This implies a **Rendering Issue** (alpha, size, coordinate, z-index).
    *   *Test*: Use the "Force Show" toggle. If that works, then "Rendering" is proven fine, and we loop back to logic.

Since you reported "Force Show works", we know Rendering is fine. The issue is strictly that **Candidates = 0**.
This logically requires **D = 0**, which implies **MinSpeedSq > JitterThreshold**.
**Prediction**: Your HUD will show `MinSpeedSq` floating around `1e-3` or `1e-2`, which is higher than our strict `1e-4` threshold.
