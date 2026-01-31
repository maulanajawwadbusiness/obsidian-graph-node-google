# Forensic Report: Overlay + Engine Logic Health Check

## 1. Scope
- src/playground/components/CanvasOverlays.tsx - input isolation / HUD controls.
- src/physics/engine.ts - degrade-state gating and interaction locking.
- src/physics/engine/forcePass.ts - force pass, pre-roll symmetry breaking, focus helpers.

## 2. Findings

### A. Overlay input guarding
- The debug panel grabs every mouse*, pointer*, and wheel event that hits the overlay container (src/playground/components/CanvasOverlays.tsx:137-205). That satisfies the "panel owns 100% of the input" doctrine, so clicks inside the HUD never tunnel into the canvas.

### B. Degrade-state lock is over-eager
- setDegradeState bails out unconditionally whenever interactionLock is true (src/physics/engine.ts:324-334). The intended exceptions ("allow FATAL updates or resets") are never reached because the second return fires even for severity === 'HARD' or for a level 0 reset, so the scheduler can no longer surface emergency/hard degrade reasons while a drag lock is held. The engine remains stuck in whatever mode it started in until the next unlock, potentially masking fatal overloads.

### C. Force pass remains resilient
- The applyForcePass pre-roll path (src/physics/engine/forcePass.ts:41-169) zeroes forces, ramps topology springs, and injects deterministic cluster-level biases with escape windows for null-force hubs. Normal execution then throttles repulsion/collision passes via stride offsets, adds focus-only work when required, and scales every force through the energy envelope before applying the drag override, keeping the pass deterministic while discharging debt in bounded chunks.

### D. Debug pane blocking UI buttons
- When debugOpen is true the overlay renders a fixed-position panel (DEBUG_OVERLAY_STYLE in src/playground/graphPlaygroundStyles.ts:40-73) with pointerEvents: 'auto', a high z-index, and a width of 420px (or calc(100vw - 32px) when the viewport is narrow). Because the panel also stopPropagation()s on every pointer/mouse/wheel event (CanvasOverlays.tsx:137-205), it swallows clicks anywhere inside that bounding box even if the visible controls are smaller. The reported "can't click any UI button" symptom is thus explained: any other control that sits under that hit area (top-left toggles, sidebar buttons, etc.) becomes unresponsive while the HUD is open because the overlay intercepts their events before they can reach those targets.

## 3. Recommendations
- Fix the hit testing first: shrink the debug overlay's interactive footprint so it only captures events inside the visible HUD. The overlay already has `pointerEvents: 'auto'` and `stopPropagation` on every mouse/pointer/wheel handler (`CanvasOverlays.tsx:137-205`), so you can wrap the visual HUD content in a nested container with `pointerEvents: 'none'` and re-enable propagation on the bare backdrop, or change the `DEBUG_OVERLAY_STYLE` width/height to match the actual panel and let clicks outside fall through to the canvas (see lines 40-73 in `src/playground/graphPlaygroundStyles.ts`). That will restore the ability to click top-left toggles / sidebar buttons without sacrificing the doctrine that the panel should own input while visible.
- Triage the degrade lock: keep the early return that rejects normal mode shifts when `interactionLock` is set, but allow the scheduler to apply `severity === 'HARD'` updates or `level === 0` resets. Concretely, replace the unconditional second `return` in `PhysicsEngine.setDegradeState` (`src/physics/engine.ts`:324-334) with logic that only exits early when `severity !== 'HARD'` and `level !== 0`. That way fatal/overload modes still pass through during drags while ordinary throttles stay locked.

## 4. Suggested verification
- Test the overlay fix by opening the HUD and confirming that clicking the nearby theme/sidebar toggle buttons still fires (or closes the HUD) while the panel stays interactive.
- Test the scheduler fix by forcing a degrade update (e.g., simulate high `maxPhysicsBudgetMs` usage) while dragging and verify `[Degrade] reason=OVERLOAD` still logs and the HUD shows the new level even with `interactionLock` true.
