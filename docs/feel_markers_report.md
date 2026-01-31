# Feel Markers Report (Rest + Conflict)

## Scope
Added dev-only “feel markers” rendered on the canvas to visualize rest state and correction conflict, wired into the existing Physics HUD panel toggles.

## What Changed
- **Rest Marker**: A tiny dot rendered just below each dot when it is in a rest candidate state. Cyan indicates true rest (velocity below sleep epsilon). Amber indicates “fake rest” (jitter above warn epsilon) even when the settle ladder says sleep.
- **Conflict Marker**: A thin halo ring around dots where PBD correction opposes velocity. Conflict intensity is smoothed via a per-dot EMA to avoid flicker.
- **HUD Toggles**: Added dev-only checkboxes and an intensity slider under the top-left debug panel.

## Where
- Rendering: `src/playground/rendering/graphDraw.ts` draws the markers during the existing dot pass (no extra loops).
- Physics: `src/physics/engine/corrections.ts` now updates per-dot `conflictEma` based on correction-vs-velocity opposition.
- UI: `src/playground/components/CanvasOverlays.tsx` adds toggles and intensity slider.

## Perf Notes
- No additional per-frame allocations beyond the existing node iteration.
- Marker draw reuses the dot render loop and only runs when toggles are enabled.
- EMA is updated inside the existing corrections pass to avoid new scans.

## How to Toggle
1. Click **Debug** (top-left).
2. In the panel, enable **Show Rest Markers** and/or **Show Conflict Markers**.
3. Adjust **Marker Intensity** if needed for visibility.

## Manual Verification
- Run **Settle Test** at N=5/20/60 and confirm cyan markers appear on truly resting dots; amber marks jitter.
- Run **Drag Test** and confirm conflict halos appear around the dragged cluster and fade after release.
