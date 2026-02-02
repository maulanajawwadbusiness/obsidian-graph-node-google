# Fix Repulsion A3: Stats Reset Lifecycle

**Date**: 2026-02-02
**Goal**: Ensure telemetry persists across frames so 0-value flickers don't hide the truth.

## Changes

### 1. `PhysicsHudSnapshot` (src/physics/engine/physicsHud.ts)
Added `lastFrame` fields:
- `repulsionProofCalledLastFrame`
- `repulsionProofPairsCheckedLastFrame`
- `repulsionProofMaxForceLastFrame`

### 2. `engineTickHud.ts`
Populated these fields by reading from `engine.lastDebugStats`. 
- `engine.lastDebugStats` is preserved at the end of every tick (in `engineTick.ts`), so it reliably holds the *completed* state of the previous frame, regardless of how early the current frame is in its lifecycle.

### 3. `CanvasOverlays.tsx`
Updated the "Repulsion Proof" section.
- **Called**: Shows `(Prev: Y/N)`
- **Pairs**: Shows `Current (Prev)`
- **MaxForce**: Shows `Current (Prev)`

## Verification
- **Intermittent Execution**: If repulsion runs every other frame, you won't just see `YES` flickering to `NO`. You will see `YES (Prev: NO)` and `NO (Prev: YES)`, confirming the cadence.
- **Persistence**: Even if you pause the renderer (if logic allowed), the last frame stats remain visible.

## Deliverables Summary
- **A1**: Toggle Real (Config + HUD)
- **A2**: Tick Mode (HUD display + Config Wiring)
- **A3**: Lifecycle (LastFrame snapshots)

Fixed the "bucket A" failures: Repulsion execution is now visible, controllable, and persistent.
