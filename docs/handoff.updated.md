# Handoff - Document Viewer + Bookmark Tab

## What Is Done and Locked
- Document viewer v1 is functional and polished (peek/open, search, highlights).
- Viewer width is controlled by a single knob: `--dv-panel-scale` in `src/index.css`.
- Bookmark tab is integrated and synced to the panel width via `--panel-width`.
- No horizontal scrollbar is a hard invariant and is enforced by layout and wrap rules.

## What Is Safe to Change
- Visual styling in `src/document/viewer/viewerTokens.css` (colors, shadows, spacing).
- Theme values in `src/document/viewer/docTheme.ts` (font, line height).
- Width knob in `src/index.css` (`--dv-panel-scale` or `--dv-panel-base-width`).

## What Must Not Change
- `--panel-width` must remain the shared token for panel width and tab position.
- `overflow-x: hidden` and wrap rules in the viewer must remain intact.
- Bookmark tab z-index must stay above the panel.
- Sheet width must remain smaller than panel width.

## Quick Regression Checklist
- Open viewer shows no horizontal scrollbar.
- Long words wrap without clipping.
- Tab stays visible in all states and moves with panel edge.
- Viewer panel width follows `--dv-panel-scale`.
- Open/close motion stays smooth and synchronized with the tab.

## Where to Look When Something Breaks
- Panel width or tab mismatch: `src/index.css` and `src/PresenceStrip/PresenceStrip.css`.
- Horizontal scroll or clipping: `src/document/viewer/viewerTokens.css` (overflow and wrap rules).
- Sheet width vs panel width: `src/index.css` and `src/document/viewer/docTheme.ts`.
- Viewer layout bugs: `src/document/viewer/DocumentViewerPanel.tsx`.

## How to Run
- `npm run dev` for local dev.
- `npm run build` for TypeScript and build verification.

## Next Suggested Milestones
- Add a small visual ruler to validate panel width in dev builds.
- Improve list detection if needed (currently regex-based for simple lists).
- Add a visual indicator for scanned PDFs (warnings).

End of document.
