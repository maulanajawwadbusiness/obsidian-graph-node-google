# XPBD Run 1: Mini Run 2 - Telemetry (Proof-of-Life 0)

## Goal
Establish "Proof-of-Life 0" telemetry for XPBD springs. This ensures we can verify the execution of the spring constraint stage via the HUD before implementing the actual math.

## Changes

### 1. Snapshot Extensions
Added `xpbdSpring*` fields to `PhysicsHudSnapshot` in `src/physics/engine/physicsHud.ts`.
- `xpbdSpringEnabled`: boolean
- `xpbdSpringConstraints`: number (Live count of links)
- `xpbdSpringSolved`: number (Placeholder)
- `xpbdSpringCorrMaxPx`: number (Max correction magnitude)
- `xpbdSpringErrAvgPx`: number (Average error)
- `xpbdSpringSolveMs`: number (Execution time of stub)

### 2. Engine Accumulators
Updated `PhysicsEngine.xpbdFrameAccum` in `src/physics/engine.ts` to hold per-frame aggregated values for these new fields, initialized to 0/false.

### 3. Telemetry Population
Instrumented `applyXPBDEdgeConstraintsStub` in `src/physics/engine/engineTickXPBD.ts`:
- Wrapped execution in a manual `getNowMs()` timer.
- Populates `xpbdFrameAccum.springs.solveMs`.
- Updates `count` from `engine.links.length`.

### 4. HUD Rendering
Updated "XPBD Proof-of-Life" and "XPBD Springs" sections in `src/playground/components/CanvasOverlays.tsx`.
-   **Always Visible**: Both blocks show in XPBD and Legacy modes.
-   **Grayed Out**: Text turns gray (`#888`) when not in XPBD mode, Bright Green (`#adff2f`) when active.
-   **Metrics**:
    -   `enabled`: true/false
    -   `constraints`: Live link count
    -   `solved`: Linked to `iter` accumulator (prepared for real solver count)
    -   `solve`: Execution time (includes dummy 100-iter loop for proof-of-life)
    -   `errAvg`: `errSum / count` (Valid math, currently 0.000)

## Verification

### Manual
1.  **Launch** the application.
2.  **Toggle Modes**:
    *   **XPBD Mode**: Block is Green. `enabled: true`. `solve` should be > 0.00ms (due to dummy loop).
    *   **Legacy Mode**: Block is Grey. `enabled: false`. `solve` should be 0.00ms.
3.  **Spawn Nodes**: Press `N=250`.
    -   `constraints` tracks link count.
    -   `solve` timer scales slightly with ticking (if not optimized away).

## Next Steps
Proceed to **Mini Run 3**: Implement the actual Spring Constraint Math (Distance Constraint) and verify `solved` > 0 and `corrMax` changes.
