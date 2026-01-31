# Physics HUD Marker Report

## Summary
- Added two dev-only “feel markers” controlled from the debug panel:
  - **Rest Markers**: show a tiny dot beneath sleeping dots; amber variant indicates residual jitter while sleeping.
  - **Conflict Markers**: show a faint ring when correction direction fights velocity (constraint-vs-velocity conflict).

## Implementation Notes
- Markers are toggled via new debug panel checkboxes (default OFF).
- Render cost is bounded and allocation-free (no per-frame arrays; relies on existing per-dot state such as `isSleeping`, `lastCorrectionMag`, `lastCorrectionDir`).
- Visuals are intentionally subtle (small dot, faint ring) to avoid occlusion.

## Files Touched
- `src/playground/rendering/graphDraw.ts` (render markers).
- `src/playground/rendering/renderingTypes.ts` (render settings flags).
- `src/playground/useGraphRendering.ts` (settings propagation).
- `src/playground/components/CanvasOverlays.tsx` (debug toggles).
- `src/playground/GraphPhysicsPlayground.tsx` (state + wiring).
- `docs/physics_hud_usage.md` (usage notes).
