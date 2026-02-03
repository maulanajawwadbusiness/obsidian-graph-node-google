# Drag Highlight Glow Forensics

## Issue 1 – Ring renderer falls back to filled circle when gradient is disabled
- **Severity:** High  
- **Why it matters:** When `ThemeConfig.useGradientRing` is `false` (e.g., a future elegant ring variant or a runtime toggle), `renderRing` drops out of the gradient code path but then executes a filled disc render (`ctx.beginPath()` + `ctx.arc()` + `ctx.fill()`). That orphaned fill/stroke sequence overwrites the clean ring/occlusion look, breaks the occlusion masking beneath the ring, and undermines the “ring with gradient overlay” assumption described in the doctrine.  
- **Repro steps:** Toggle `useGradientRing` to `false` in `ELEGANT_THEME` (or any ring-based skin) and drag a dot; instead of seeing a ring, you see a filled disk that also applies neighbor dimming incorrectly.  
- **Evidence:** `src/playground/rendering/graphDraw.ts:330-369` executes a fill/stroke block in the `else` branch of `if (theme.useGradientRing)` (lines 330‑369) while still keeping the ring’s `renderFunctions` ordering. A ring-like skin therefore renders twice: once as the gradient ring (never executed) and again as a filled circle that does not honor `occlusionColor` or transparent stroke logic. This contradicts the “ring” look described in `docs/AGENTS.md`.  
- **Suggested guard:** Keep the ring path working by either (a) keeping the gradient path on but adjusting its parameters, or (b) adding a proper non-gradient ring draw (stroke-only) so the ring retains its hollow silhouette and occlusion disk even when gradients are disabled.

## Issue 2 – Drag highlight allows hover target to “steal” brightening
- **Severity:** Medium  
- **Why it matters:** While drag-only highlight should protect only the dragged “dot” plus its neighbors, `renderNodes` builds `isHoveredNode` as `node.id === hoverStateRef.current.hoveredNodeId || node.id === engine.draggedNodeId`. During a drag, the hover-selection code still runs (because `ALLOW_HOVER_DURING_DRAG` is `true`) and can switch `hoveredNodeId` to another node if the pointer hovers near it. That second node now matches `isHoveredNode`, so it is undimmed (brightened) even though it is neither dragged nor a neighbor. The effect is a neighbor set that flickers to whatever node the pointer happens to graze, which violates the “drag only” highlight documented in the runbook (Run 10 checklist).  
- **Evidence:** `src/playground/rendering/graphDraw.ts:254-270` uses `isHoveredNode` to grant full opacity, and `hoveredNodeId` is still mutable while dragging because `ALLOW_HOVER_DURING_DRAG` remains `true` and `updateHoverSelection` executes on every frame (`graphRenderingLoop`). There is nothing discriminating between true drag focus and incidental hover, so the “bright ring + glow stays on drag target” guarantee is broken.  
- **Suggested fix:** Gate the brightening logic so that only `engine.draggedNodeId` (or the locked neighbor set) controls `isHoveredNode` while `dimEnergy > 0`. Alternatively, keep hover selection running but stop `hoveredNodeId` from changing once a drag lock is active unless `engine.draggedNodeId` releases.

## Issue 3 – Highlighted edge pass allocates `Set` each draw pass
- **Severity:** Medium (performance)  
- **Why it matters:** The neighbor highlight renderer creates a fresh `Set<string>` on every `drawEdgeBatch` call (`src/playground/rendering/graphDraw.ts:52`). During an active drag this `drawEdgeBatch` runs twice per frame, and the `Set` is populated, iterated, and discarded. For large graphs (hundreds of edges) this introduces GC churn and pollutes the “slushless 60fps” doctrine that forbids frame allocations (`docs/AGENTS.md §1.A`).  
- **Evidence:** `drawEdgeBatch` is invoked with highlight active (lines 102‑120), so the `Set` allocation happens even when the neighbor filter already prevents duplicates via `neighborEdgeKeys`. The `edgeDrawScratch` already exists (`hoverStateRef.current.edgeDrawScratch`), so a reusable `Set` or the scratch structure could be used instead.  
- **Suggested guard:** Reuse a single `Set` (e.g., hoist `const drawnKeys = hoverStateRef.current.edgeDrawScratch;` or a dedicated `Set` stored on `hoverStateRef`) instead of creating a new one each pass, aligning the code with the “Zero Thrash” rule.

## Verification Notes
- None of these issues produce console errors, so verification must be visual/performance‑based:
  1. Toggle `ELEGANT_THEME.useGradientRing` (or add a test theme that sets it to `false`) and confirm the ring still renders as an occluding stroke without filling the whole node.  
  2. Drag a dot while moving the pointer over other nodes; ensure only the dragged node (and its cached neighbors) stay at full opacity regardless of pointer proximity.  
  3. Run a profiler with a large graph and watch for GC spikes when neighbor highlight is active; the `Set` allocation should either vanish or be significantly reduced after the fix.
