# Forensic Report: Graph Top-Right Toolbar Iteration (2026-02-14)

## Update (2026-02-14, Dots Menu Consolidation)
This report has been updated to reflect the current shipped truth in `CanvasOverlays.tsx` after the dots-menu consolidation.

## Scope
This report captures the graph screen toolbar and share popup work done today in `src/playground/components/CanvasOverlays.tsx`.

## Timeline of Applied Changes
1. Hid dev download button on graph overlay.
2. Added top-right 3-icon strip (dots, share, fullscreen) with fixed sizing knob.
3. Switched icons from raw image rendering to mask-based tint rendering for consistent visual control.
4. Added hover behavior and then simplified to opacity-only behavior based on product direction.
5. Set icon opacity behavior to idle/hover transitions.
6. Wired fullscreen icon to real fullscreen toggle using `useFullscreen()`.
7. Added fullscreen icon state swap:
   - enter icon when windowed
   - exit icon when fullscreen
8. Added fullscreen-only size scaling knob.
9. Implemented share icon popup menu UI with anchored placement and input shielding.
10. Tuned share popup visuals (size scaling, padding, background color, viewport-safe placement).
11. Fixed share popup overflow by switching horizontal anchoring to right-based positioning.
12. Removed share row icons per latest direction (text-only rows).
13. Reduced share menu rows to:
   - `Save as Link`
   - `Save as ARN`
14. Added per-icon visibility toggles for top-right icons and defaulted all to hidden:
   - `SHOW_TOP_RIGHT_DOTS_ICON = false`
   - `SHOW_TOP_RIGHT_SHARE_ICON = false`
   - `SHOW_TOP_RIGHT_FULLSCREEN_ICON = false`
15. Updated dots icon asset source to vertical ellipsis, then user reverted intent to `3_dot_icon.png` (final icon source currently follows repo state after latest user adjustment path).

## Current Functional State
- Top-right action entry is the dots icon (`3_dot_icon.png`) only.
- Dots click opens a compact popup menu with 2 rows:
  - `(fullscreen icon) Fullscreen`
  - `(share icon) Share Interface`
- Selecting `Fullscreen` runs the real fullscreen toggle via `useFullscreen()`.
- Selecting `Share Interface` opens the share popup.
- Share popup currently has 2 rows:
  - `Save as Link`
  - `Save as ARN`
- Menu and popup positioning use viewport-clamped anchored placement so they stay inside visible bounds.

## Input Safety and Overlay Contract
- Dots trigger, dots menu rows, and share popup rows stop pointer and wheel propagation to prevent canvas drag/capture leaks.
- Dots menu and share popup close on outside click and Escape.
- Both overlays use anchored + clamped placement to avoid viewport overflow.

## Validation Performed
- Repeated `npm run build` checks were executed after each major toolbar/popup modification.
- Build completed successfully in final state at time of this report.

## Files Touched for This Workstream
- `src/playground/components/CanvasOverlays.tsx`
- `docs/report_2026_02_14_graph_topright_toolbar_forensic.md` (this file)

## Notes
- This report is focused on graph toolbar/share menu/fullscreen/dots work only.
- Other modified files present in the branch may belong to parallel workstreams.
