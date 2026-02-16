# Step 5+7 Hardening Run 7 - Preview Branch Sanity

Date: 2026-02-16
Run: r7
Scope: confirm preview branch remains boxed-mode and unaffected by graph-screen viewport provider relocation.

## Verification

1. `SampleGraphPreview` still provides boxed viewport context:
- `src/components/SampleGraphPreview.tsx:346`
  - `<GraphViewportProvider value={boxedViewport}>`
- Boxed viewport state remains explicit:
  - `mode: 'boxed'`
  - `source: 'container'`
  - seen at `src/components/SampleGraphPreview.tsx:317-318`

2. Graph-screen provider is now isolated in `GraphScreenShell`:
- `src/screens/appshell/render/GraphScreenShell.tsx:71`
  - `<GraphViewportProvider value={graphPaneViewport}>`

## Result

- Preview branch contract remains correct.
- No regression in preview viewport mode/source wiring.
- Graph-screen provider move did not alter preview seam behavior.
