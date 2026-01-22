# Document Viewer + Bookmark Tab Report

## Overview
The document viewer now functions as a dedicated reading surface with stable rhythm, premium controls, and a sheet-like presentation. It is designed to avoid horizontal scrolling entirely, keep text wrapping predictable, and expose a single width knob for tuning the panel size. The bookmark tab is kept visible and aligned to the panel edge during open/close transitions.

## Width + Layout System
The viewer width is now derived from a single scale knob and shared tokens in `:root`.

Key tokens:
- `--dv-panel-scale`: primary knob (e.g., 1.0, 0.9, 1.1).
- `--dv-panel-base-width`: base width (px).
- `--dv-panel-width`: computed width used by the panel and tab.
- `--dv-content-padding-x`: horizontal padding inside the viewer.
- `--dv-sheet-padding`: padding on the sheet itself.
- `--dv-sheet-width`: computed from `--dv-panel-width` minus padding.

Computation (in `src/index.css`):
- `--dv-panel-width = --dv-panel-base-width * --dv-panel-scale`
- `--panel-width = --dv-panel-width` (shared token used by panel and tab)
- `--dv-sheet-width = --dv-panel-width - ( --dv-content-padding-x + --dv-sheet-padding ) * 2`

Horizontal scroll is forbidden and enforced by:
- `overflow-x: hidden` on `.dv-content`.
- `min-width: 0` and `box-sizing: border-box` on sheet/container elements.
- `white-space: normal`, `overflow-wrap: anywhere`, `word-break: break-word` on paragraphs.

## Bookmark Tab Integration
The bookmark tab is fixed-positioned and follows the panel width token.

Positioning behavior:
- Closed: tab at viewport left edge (`left: 0`).
- Open: tab moves to panel edge via `left: var(--panel-width)`.

Motion sync:
- Uses the same `--panel-width` token as the panel width.
- Uses the same transition curve for smooth, glued motion.

Stacking:
- `.presence-strip-container` uses a higher `z-index` than the panel so the tab never gets buried.

## Typography + Theme Notes
- UI base size: 12px for header/labels; body text uses doc theme size (13px by default).
- Filename is demoted to metadata (lighter weight/opacities).
- Paragraph and list spacing are CSS-owned (no inline margins).
- Wrapping is enforced so long lines never cut off or create horizontal scroll.

## Key Invariants (Do Not Break)
- No horizontal scroll inside the viewer.
- Panel width and tab position must both derive from the shared `--panel-width` token.
- Tab must always be visible (z-index above panel).
- Text must always wrap and stay inside the sheet.
- The sheet should remain slightly narrower than the panel to preserve breathing room.

## Files Touched and Roles
- `src/index.css`: global width tokens and `--panel-width` single source of truth.
- `src/document/viewer/viewerTokens.css`: viewer styling, sheet sizing, wrapping rules, spacing rhythm, button polish.
- `src/document/viewer/DocumentViewerPanel.tsx`: data attributes for theme/sheet, header label, sheet shadow.
- `src/document/viewer/DocumentBlock.tsx`: list heuristics and CSS-owned margins.
- `src/document/viewer/docTheme.ts`: paragraph gap and sheet width wiring via CSS variable.
- `src/PresenceStrip/PresenceStrip.css`: tab position via `--panel-width` and raised z-index.
