# Left Window Work Report

**Date:** 2026-01-26  
**Scope:** Implemented half-left window scaffold and split-view layout; removed old text preview panel.

---

## Summary of Changes

- Added a new **HalfLeftWindow** component that renders as a flex sibling at **50% width**, with an empty-state placeholder when no document is loaded and a simple header + close button.
- Rewired the main playground layout so the left window is a **sibling before** the canvas container; the canvas auto-resizes to the right half.
- Removed the old `TextPreviewPanel` and turned the bottom-left button into an always-available **viewer toggle** (works even with no document).
- Ensured **hover state clears** on open/close to avoid stuck glow when layout changes.
- Kept overlays above the viewer but **moved debug overlay into the right half** when viewer is open so it doesn’t steal left-window pointer input.
- Blocked drag/drop on the left window (as required); only the right/canvas area parses files.

---

## Files Added

- `src/playground/components/HalfLeftWindow.tsx`  
  - Renders the left panel with empty state, close button, and pointer “membrane” handlers.

---

## Files Updated

- `src/playground/GraphPhysicsPlayground.tsx`
  - Mounts `HalfLeftWindow` as a sibling before the canvas container.
  - Wires toggle/close to clear hover and open/close the viewer.
  - Removes old `TextPreviewPanel`.
  - Passes `viewerOpen` to overlays.

- `src/playground/useGraphRendering.ts`
  - Re-exports `clearHover` so layout changes can explicitly reset hover.

- `src/playground/components/TextPreviewButton.tsx`
  - Always visible; toggles viewer even with no document.
  - Updated labels to “Open Viewer / Close Viewer”.

- `src/playground/components/CanvasOverlays.tsx`
  - Debug overlay shifts to the right half when the viewer is open.

- `src/playground/components/AIActivityGlyph.tsx`
  - Moves the glyph into the right half when the viewer is open.

---

## Behavioral Notes (Validated by Design)

- Viewer opens with **no document loaded** and shows a clear empty state.
- Hover highlights **clear immediately** on open/close (prevents stuck glow).
- Drag/drop on the left window is **blocked**; parsing only happens on the right/canvas side.
- Debug overlay and popups remain above, but **left window retains pointer ownership** in its area.

---

## Known Non-Goals (Intentionally Not Implemented)

- Real document viewer engines (DOCX/MD/TXT/PDF).
- Scroll/highlight adapter wiring (`DocumentViewerAdapter`).
- Wheel-based canvas zoom/pan integration.

