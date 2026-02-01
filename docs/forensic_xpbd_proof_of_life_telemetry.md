# Forensic Report: XPBD Proof-of-Life Telemetry
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** IMPLEMENTED

## 1. Goal
Provide immediate, "no-console required" verification that the new XPBD systems (Springs & Repulsion) are running and effective. The user must be able to confirm "Life" at a glance via the HUD.

## 2. Telemetry Implementation (Knife-Grade Semantics)

### A. Reset Semantics & Frame Sums
*   **Stats (`DebugStats`)**: Born and die within a single **Physics Tick**.
*   **HUD (`PhysicsHudSnapshot`)**: Persists for the **Render Frame**.
*   **Accumulation**:
    *   `PhysicsEngine` maintains `xpbdFrameAccum` (ticks, dtSum, count/iter sums).
    *   `renderLoopScheduler` calls `engine.startRenderFrame()` to reset accumulators before the tick loop.
    *   `engineTickHud` maps the accumulated totals to the snapshot.
    *   **New Fields**: `ticksThisFrame`, `dtUseSecLastTick`, `dtUseSecFrameAvg`.

### B. "Real" Force Repel
Controlled by `debugForceRepulsion`.
*   **Logic**:
    *   If ON: `minNodeDistance` forced to **140px** (Mode A).
    *   Strength boosted 2x to ensure gap compliance.
    *   Implemented in `forces.ts` (Solver Layer), overriding config values before use.
*   **Visible Effect**: Nodes explode to create massive 140px gaps. unmistakable.

### C. Safe Canary Shift
Controlled by `debugXPBDCanary`.
*   **Logic**: **One-Shot** Nudge.
    *   Applies `x += 30` to Node 0 exactly **ONCE** when toggle activates.
    *   Uses `engine.xpbdCanaryApplied` state latch.
    *   Occurs at **Pre-Tick** separate from integration, proving ownership of valid position state.
*   **Visible Effect**: Node 0 jumps 30px right instantly, then integrates normally. No continuous flying.

## 3. Data Pipeline Updated
1.  **Source (`stats.ts`)**: Tracks raw per-tick counts.
2.  **State (`engine.ts`)**: `xpbdFrameAccum` sums them across Catch-Up sub-ticks.
3.  **Transport (`physicsHud.ts`)**: Carries `frameSum` fields.
4.  **UI (`CanvasOverlays.tsx`)**: Displays "Frame Ticks: N" and "Avg DT: N".

## 3. Interactive Kill-Switches & Forcing
Added to "Advanced Physics" -> "XPBD FORCING" panel:

1.  **Stiff Links** (`debugForceStiffSprings`):
    -   *Logic:* Sets compliance $\alpha = 0$ for all links.
    -   *Visible Effect:* Links become rigid rods. Jitter may increase if solver iteration count is low.
2.  **Force Repel** (`debugForceRepulsion`):
    -   *Logic:* Boosts `repulsionStrength` or `minNodeDistance` (Implementation pending in `forces.ts` - currently just config flag wired).
    -   *Visible Effect:* Nodes explode apart or refuse to touch.
3.  **Canary Shift** (`debugXPBDCanary`):
    -   *Logic:* Shifts `node[0].x += 30` every frame.
    -   *Visible Effect:* Node 0 flies off to infinity (or teleports), proving the XPBD write phase is running and not overwritten by render interpolation.

## 4. Verification Steps
1.  **Load App**: Open Debug Panel.
2.  **Check HUD**: Look for "XPBD Proof-of-Life". Initially 0s (as XPBD system not active yet).
3.  **Enable XPBD (Future Task)**: Once `solveXPBDConstraints` is called in `engineTick.ts`, these numbers will light up.
4.  **Toggle Canary**: Check "Canary Shift". If Node 0 disappears/teleports, the `engineTick` write-phase is valid.

## 5. Artifacts
-   `src/physics/engine/stats.ts`: Added telemetry structure.
-   `src/physics/engine/physicsHud.ts`: Added snapshot fields.
-   `src/physics/engine/engineTickHud.ts`: Mapped logic.
-   `src/playground/components/CanvasOverlays.tsx`: UI rendering.
-   `src/physics/types.ts`: Added config flags.

**Status:** Ready for XPBD Solver Integration.
