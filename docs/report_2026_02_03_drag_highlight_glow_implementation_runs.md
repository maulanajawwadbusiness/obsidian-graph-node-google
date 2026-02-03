# Drag Highlight Glow Implementation Runs

## Run 1 (2026-02-03)

### Plan Summary
- Confirmed drag truth source is `engine.draggedNodeId` and it is already threaded into hover selection when rendering.
- Verified dim/highlight energy is currently driven by hover state (`hoveredNodeId`) inside `updateHoverEnergy`, so hover directly activates highlight/dim.
- Identified the clean hook: compute `highlightActive` from drag state and feed that into `updateHoverEnergy` (replacing hover-based dim). Neighbor sets are currently refreshed in `updateHoverSelection` using the locked node id, which is fed from drag state.
- Added theme-level knobs (no behavior change yet) for upcoming glow dim multiplier, edge alpha cap, and x-thing flat ring switch.

### File/Function Anchors
- Drag truth source: `engine.draggedNodeId` used in `updateHoverSelectionIfNeeded` and drag sync logic. (`src/playground/rendering/graphRenderingLoop.ts`, `updateHoverSelectionIfNeeded`, `applyDragTargetSync`).
- Dim/highlight energy: `updateHoverEnergy` currently uses `hoveredNodeId !== null` to set `targetDimEnergy`. (`src/playground/rendering/hoverEnergy.ts`, `updateHoverEnergy`).
- Neighbor sets: `updateHoverSelection` fills `neighborNodeIds`/`neighborEdgeKeys` based on `lockedNodeId` (drag) or hover selection. (`src/playground/rendering/hoverController.ts`, `updateHoverSelection`).
- Glow alpha application point: `drawTwoLayerGlow` will be modified to multiply existing `ctx.globalAlpha` rather than overwrite it. (`src/playground/rendering/canvasUtils.ts`, `drawTwoLayerGlow`).
- Ring/edge highlight: ring rendering and edge highlight passes live in `src/playground/rendering/graphDraw.ts` (specific helpers to be targeted in run 3/4).

### What Will Change in Run 2
- Update `drawTwoLayerGlow` to preserve incoming `ctx.globalAlpha` and multiply by glow alpha (and new dim knob), restoring the previous alpha on exit.
- Introduce the glow dim multiplier in the draw path so x-thing glow properly respects node opacity during highlight.

### Notes
- `docs/onboarding_dpr_rendering.md` was referenced in the doctrine but does not exist in this repo. Proceeded with caution and minimal changes.
