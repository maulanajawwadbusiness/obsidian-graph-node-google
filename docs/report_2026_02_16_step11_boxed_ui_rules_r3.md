# Step 11 Boxed UI Rules Run 3

Date: 2026-02-16
Scope: contain/disable highest-risk fullscreen-like runtime surfaces

## Changes

1. Hardened `CanvasOverlays` boxed behavior.
- File: `src/playground/components/CanvasOverlays.tsx`
- Added boxed runtime detection via `useGraphViewport()` + `isBoxedUi(...)`.
- Boxed rules applied:
  - dev download button hidden in boxed mode.
  - top-right dots/fullscreen launcher hidden in boxed mode.
  - dots menu render hard-disabled in boxed mode.
  - debug overlay render hard-disabled in boxed mode.
  - auto-close dots menu when boxed mode is active.
  - auto-close debug overlay when boxed mode is active.

2. Guarded dev JSON export against boxed `document.body` path.
- File: `src/playground/GraphPhysicsPlaygroundShell.tsx`
- `handleDevDownloadJson` now early-returns in boxed mode and increments boxed disabled counter via policy helper.
- Prevents boxed runtime from touching `document.body.appendChild(anchor)`.

## Why this run closes top offenders

1. Fullscreen toggle path in runtime overlays is now unavailable in boxed preview.
2. Fixed-position dots menu and debug HUD are removed from boxed runtime branch.
3. Direct `document.body` write in dev export path is blocked in boxed mode.

## Run 3 verification

- `npm run build` executed after changes.