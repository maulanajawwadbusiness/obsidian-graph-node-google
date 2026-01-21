# Presence Tab Integration Report

## Context
Replaced the left-side strip (DocumentDockStrip + 44px peek gutter) with the bookmark-style PresenceStrip tab, and removed the residual left gap when the document viewer is closed.

## Files Added or Updated

- src/PresenceStrip/PresenceStrip.tsx
  - Inlined local type aliases for `ViewerMode` and `DocumentState` to avoid importing from a non-existent `App` module in this repo.
  - Switched the tab icon to import from the local asset path: `src/assets/document_viewer_icon.png`.

- src/playground/GraphPhysicsPlayground.tsx
  - Rendered the new `PresenceStrip` at the app shell level so it is fixed to the viewport.
  - Mapped document viewer state to tab state:
    - `viewerMode` in store → `tabMode` (`open` if viewer is open, otherwise `presence/peek` based on hover).
  - Added hover and mouse proximity logic for the tab.
  - Mapped document status to tab state:
    - `warning` when errors or warnings exist
    - `loaded` when a document is present
    - `empty` otherwise
  - Wired tab click to open/close the viewer.

- src/document/viewer/DocumentViewerPanel.tsx
  - Removed the old strip component (`DocumentDockStrip`).
  - Updated the panel width to use `--panel-width` when open.
  - Collapsed width to `0px` when closed to remove the left gap.
  - Reset the sliver overlay to start at the left edge (no strip offset).

- src/index.css
  - Added CSS variables required by `PresenceStrip.css`:
    - `--panel-width`
    - `--transition-panel`
    - `--strip-highlight`, `--strip-highlight-dim`, `--strip-shadow-color`, `--strip-warning`
    - `--color-void`, `--color-surface`, `--color-surface-raised`
    - `--text-primary`, `--text-secondary`, `--text-muted`

## Behavior Changes

- The old left strip is removed.
- The bookmark tab now opens/closes the document viewer.
- When the viewer is closed, the panel width collapses to `0px`, eliminating the left gutter.
- The tab still exposes `peek` and proximity states for visual feedback.

## Notes

- The tab icon is loaded via module import instead of `/public` so no extra asset copy was needed.
- If you want the tab to move with a different panel width, update `--panel-width` in `src/index.css`.

## Files to Review

- src/PresenceStrip/PresenceStrip.tsx
- src/playground/GraphPhysicsPlayground.tsx
- src/document/viewer/DocumentViewerPanel.tsx
- src/index.css
