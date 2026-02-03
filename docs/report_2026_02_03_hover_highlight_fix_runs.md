# Hover Highlight Fix Runs (2026-02-03)

## Run 1 — Scandissect + repro checklist

### Call chain + render law touchpoints (with exact refs)
- **Hover selection + neighbor cache**: `hoverController.updateHoverSelection` computes the active hover id and writes `neighborNodeIds` + `neighborEdgeKeys`, but when `activeNodeId` is falsy it immediately replaces both with new empty sets (hover exit path).【F:src/playground/rendering/hoverController.ts†L744-L760】
- **Hover clear path**: `clearHover` zeroes hover identifiers/energy/flags but does *not* manage neighbor sets directly (so neighbor sets rely entirely on `updateHoverSelection`).【F:src/playground/rendering/hoverController.ts†L325-L349】
- **Energy update**: `updateHoverEnergy` drives `dimEnergy` toward `targetDimEnergy` using `theme.neighborTransitionMs` and keeps `dimEnergy` nonzero during fade-out.【F:src/playground/rendering/hoverEnergy.ts†L49-L65】
- **Render loop ordering**: render frame calls `updateHoverEnergy`, then draws links (pass 2) and nodes (pass 3).【F:src/playground/rendering/graphRenderingLoop.ts†L354-L489】
- **Links pass**: `drawLinks` gates the two-pass highlight on `dimEnergy > 0.01` and uses `neighborEdgeKeys` to include/exclude edges for dim vs highlight passes.【F:src/playground/rendering/graphDraw.ts†L34-L122】
- **Nodes pass (opacity)**: `drawNodes` computes `nodeOpacity` based on `dimEnergy`, `neighborNodeIds`, and hovered state.【F:src/playground/rendering/graphDraw.ts†L240-L254】
  - **Ring path** applies `nodeOpacity` (e.g., occlusion/ring/glow paths).【F:src/playground/rendering/graphDraw.ts†L256-L334】
  - **Filled path (NORMAL)** does *not* apply `nodeOpacity` before fill/stroke, so x-things never dim when `nodeStyle === 'filled'`.【F:src/playground/rendering/graphDraw.ts†L352-L359】
- **Alpha stomping inside helpers**: `drawGradientRing` resets `ctx.globalAlpha = 1` per segment (could override caller opacity unless re-applied).【F:src/playground/rendering/canvasUtils.ts†L16-L52】 `drawTwoLayerGlow` also resets alpha to 1 on exit (safe but worth noting for dim interactions).【F:src/playground/rendering/canvasUtils.ts†L150-L191】

### Root-cause confirmations (for next runs)
- **Filled node dim missing**: The filled render path uses `fill()` + `stroke()` without applying `nodeOpacity`, unlike ring paths that set `ctx.globalAlpha` before draw. This matches the reported “x-things nodes don’t dim” failure.【F:src/playground/rendering/graphDraw.ts†L240-L359】
- **Edge “holes” on hover exit**: `dimEnergy` decays over `neighborTransitionMs` but `neighborEdgeKeys` is cleared immediately when `activeNodeId` is null; this can trigger pass1 dimming with no pass2 highlight during fade-out, causing the ghost/holes behavior described.【F:src/playground/rendering/hoverController.ts†L744-L760】【F:src/playground/rendering/hoverEnergy.ts†L49-L65】【F:src/playground/rendering/graphDraw.ts†L94-L114】

### Repro checklist (visual)
1. Hover a dot (NORMAL theme/filled node style) → observe that non-neighbor dots do **not** dim (opacity unchanged).
2. Hover a dot then exit → watch neighbor edges: blue highlight disappears instantly while dim fade continues, producing ghost lines/holes.
3. Toggle between ring vs filled style (if available) to compare opacity behavior.


## Run 2 — apply opacity for filled dots

### Change
- Applied `nodeOpacity` in the filled draw path so non-neighbor dots dim during hover when `nodeStyle === 'filled'`.【F:src/playground/rendering/graphDraw.ts†L349-L358】

### Visual check
- Manual verification pending (no browser tooling available in this environment).

## Run 3 — ctx alpha hygiene (helpers)

### Change
- Preserved caller opacity in `drawGradientRing` by capturing `baseAlpha` and reusing it per segment instead of forcing `globalAlpha = 1`.【F:src/playground/rendering/canvasUtils.ts†L16-L52】

### Visual check
- Manual verification pending (no browser tooling available in this environment).

## Run 4 — sticky neighbor sets during dim fade

### Change
- Prevented `hoverController` from clearing neighbor sets immediately on hover exit; instead, the render loop clears them only after `dimEnergy` decays to ~0, avoiding highlight holes during fade-out.【F:src/playground/rendering/hoverController.ts†L744-L760】【F:src/playground/rendering/graphRenderingLoop.ts†L354-L377】

### Visual check
- Manual verification pending (no browser tooling available in this environment).

## Run 5 — de-dupe neighbor edge draws

### Change
- Added a scratch de-duplication set to ensure each edge key renders once per pass, preventing double-drawn neighbor edges from showing a dim underlay beneath blue highlight.【F:src/playground/rendering/graphDraw.ts†L45-L94】【F:src/playground/rendering/renderingTypes.ts†L99-L273】

### Visual check
- Manual verification pending (no browser tooling available in this environment).

## Run 6 — hover-exit fade coherence

### Change
- Snapped `dimEnergy` to zero once it decays below the same epsilon used for highlight gating, ensuring the blue highlight and dim pass end cleanly together (no lingering partial state).【F:src/playground/rendering/hoverEnergy.ts†L4-L72】

### Visual check
- Manual verification pending (no browser tooling available in this environment).

## Run 7 — protect hovered + neighbors (all styles)

### Change
- Added hover brightness boost for filled dots so hovered dot brightening applies consistently across ring and filled styles while keeping dim protection logic intact.【F:src/playground/rendering/graphDraw.ts†L340-L366】

### Visual check
- Manual verification pending (no browser tooling available in this environment).

## Run 8 — timing + target opacity alignment

### Change
- Aligned hover timing/brightness documentation to the actual 100ms neighbor transition and 30% hover brighten values to avoid drift in visual expectations.【F:src/visual/theme.ts†L102-L380】

### Visual check
- Manual verification pending (no browser tooling available in this environment).

## Run 9 — perf + allocation cleanup

### Change
- Reused existing neighbor sets during hover updates instead of allocating new `Set` instances each frame, reducing GC churn during hover/drag. Neighbor edge keys now reuse the same sets with `.clear()` + refill semantics.【F:src/playground/rendering/hoverController.ts†L29-L770】

### Visual check
- Manual verification pending (no browser tooling available in this environment).

## Run 10 — docs + final verification checklist

### Change
- Added the hover highlight render law to system docs (classification sets, energy timing, and pass order) to lock the expected visual contract in writing.【F:docs/system.md†L200-L245】

### Manual verification checklist
- Hover any dot → x-things dim to ~20% while hovered dot brightens.
- Neighbor edges fade to #63abff in ~100ms and stay crisp (no dim underlay).
- Hover exit → blue highlight and dim fade out together with no ghost lines.
- Rapid hover switching → no holes/flicker.
- Drag, zoom, pan → hover law remains consistent.

### Visual check
- Manual verification pending (no browser tooling available in this environment).
