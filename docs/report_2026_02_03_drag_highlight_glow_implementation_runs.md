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

## Run 2 (2026-02-03)

### Summary
- Updated two-layer glow rendering to preserve incoming canvas alpha and multiply glow alpha against it.
- Added glow dim multiplier usage on the glow pass so dimmed x-thing glow can be tuned without changing base behavior (default 1.0).

### File/Function Anchors
- `src/playground/rendering/canvasUtils.ts` → `drawTwoLayerGlow` now multiplies `baseAlpha * inner/outerAlpha` and restores `baseAlpha` on exit.
- `src/playground/rendering/graphDraw.ts` → glow pass applies `theme.xThingGlowDimMul` when opacity is already dimmed.

### Verification Notes
- Manual render verification still required (no runtime checks executed in this run).

## Run 3 (2026-02-03)

### Summary
- Added highlight-aware ring logic to flatten x-thing rings to a flat blue during highlight.
- Enabled flat ring behavior for elegant theme via `xThingFlatRingEnabled`.

### File/Function Anchors
- `src/playground/rendering/graphDraw.ts` → `renderRing` uses `isXThing` to drive flat ring colors.
- `src/visual/theme.ts` → `ELEGANT_THEME.xThingFlatRingEnabled = true`.

### Verification Notes
- Manual render verification still required (no runtime checks executed in this run).

## Run 4 (2026-02-03)

### Summary
- Capped neighbor edge highlight alpha to 0.8 while still fading with dimEnergy.
- Set elegant theme edge highlight alpha cap to 0.8.

### File/Function Anchors
- `src/playground/rendering/graphDraw.ts` → highlight edge pass uses `highlightAlpha` capped by `edgeHighlightAlphaCap`.
- `src/visual/theme.ts` → `ELEGANT_THEME.edgeHighlightAlphaCap = 0.8`.

### Verification Notes
- Manual render verification still required (no runtime checks executed in this run).

## Run 5 (2026-02-03)

### Summary
- Switched dim/highlight trigger to drag-only by wiring highlightActive from `engine.draggedNodeId` into hover energy.
- Prevented hover selection updates from rebuilding neighbor sets; only drag-locked selection refreshes neighbors.

### File/Function Anchors
- `src/playground/rendering/hoverEnergy.ts` → `updateHoverEnergy(..., highlightActive)` now sets `targetDimEnergy` based on drag state.
- `src/playground/rendering/graphRenderingLoop.ts` → passes `!!engine.draggedNodeId` into `updateHoverEnergy`.
- `src/playground/rendering/hoverController.ts` → neighbor cache updates only when `lockedNodeId` is set (drag).

### Verification Notes
- Manual render verification still required (no runtime checks executed in this run).

## Run 6 (2026-02-03)

### Summary
- Kept neighbor sets sticky until dimEnergy fully decays to zero after drag ends.

### File/Function Anchors
- `src/playground/rendering/graphRenderingLoop.ts` → neighbor cache clear gated by `dimEnergy`, `targetDimEnergy`, and `draggedNodeId`.

### Verification Notes
- Manual render verification still required (no runtime checks executed in this run).

## Run 7 (2026-02-03)

### Summary
- Allowed hover selection to update during drag while keeping highlight neighbor sets locked to the dragged dot.

### File/Function Anchors
- `src/playground/rendering/hoverController.ts` → drag lock no longer forces hover selection when `allowHoverDuringDrag` is enabled.

### Verification Notes
- Manual render verification still required (no runtime checks executed in this run).

## Run 8 (2026-02-03)

### Summary
- Added tuning guidance comments for glow dim multiplier and edge highlight alpha cap knobs.

### File/Function Anchors
- `src/visual/theme.ts` → knob comments updated with suggested ranges.

### Verification Notes
- Manual render verification still required (no runtime checks executed in this run).

## Run 9 (2026-02-03)

### Summary
- Hoisted drag-hover toggle to a module-level constant to avoid per-call allocation.

### File/Function Anchors
- `src/playground/rendering/hoverController.ts` → `ALLOW_HOVER_DURING_DRAG` constant.

### Verification Notes
- Manual render verification still required (no runtime checks executed in this run).

## Run 10 (2026-02-03)

### Summary
- Added a consolidated runbook and per-run revert checkpoints for drag-only highlight/glow changes.
- Corrected elegant vs normal defaults for x-thing flat ring and edge highlight alpha cap.

### Visual Verification Checklist
- During drag: x-things dot body + glow dim to ~20% (obvious).
- x-things ring is flat #63abff and still dims correctly.
- Neighbor edges are #63abff but visibly less intense (0.8 cap) and still fade.
- On release: smooth return to normal, no holes, no ghost lines.
- Hover alone does NOT dim/highlight anything (tooltip ok).

### Runbook (How to Verify)
1. Start the playground in elegant mode and ensure hover alone does not dim or highlight.
2. Click + drag a dot to activate highlight; verify non-neighbors dim and neighbors stay bright.
3. Confirm x-thing dots use flat blue rings and that their glow dims with the body.
4. Release drag; ensure neighbor sets fade out smoothly without flicker.

### Revert Checkpoints (Per Run)
- Run 1: knobs + plan doc — revert with `git revert c9b63f8`.
- Run 2: glow respects opacity — revert with `git revert 09dfbbf`.
- Run 3: x-thing flat ring — revert with `git revert 27cd17b`.
- Run 4: edge highlight cap — revert with `git revert dae839d`.
- Run 5: drag-only highlight trigger — revert with `git revert 738e920`.
- Run 6: sticky neighbor sets — revert with `git revert 07be5f3`.
- Run 7: hover vs drag stabilization — revert with `git revert 2cfaacc`.
- Run 8: knob tuning guidance — revert with `git revert 7a9b47c`.
- Run 9: perf cleanup — revert with `git revert 3675125`.
- Run 10: runbook + checkpoints — revert with `git revert <RUN10_SHA>`.
