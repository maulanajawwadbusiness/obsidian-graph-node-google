# Step 5+7 Hardening Run 5 - Attach Graph Pane Ref

Date: 2026-02-16
Run: r5
Scope: attach stable ref to real graph-screen pane element.

## Changes

File changed:
- `src/screens/appshell/render/GraphScreenShell.tsx`

Update:
- Added `graphPaneRef` (`React.useRef<HTMLDivElement | null>(null)`).
- Attached it to:
  - `<div className="graph-screen-graph-pane" ...>`

## Why this seam is correct

- This pane is the real graph viewport container in graph mode.
- It excludes left structural sidebar width.
- Runtime subtree and loading gate both render inside this pane via `children`.

## Note

- No layout/style changes were introduced.
- Ref is inert until provider wiring in run 6.
