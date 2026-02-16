# Step 8 Resize Observer Run 3 - Preview Wiring

Date: 2026-02-16
Run: r3
Scope: switch SampleGraphPreview to live boxed viewport updates.

## File changed
- `src/components/SampleGraphPreview.tsx`

## Wiring changes

1. Added hook import:
- `useResizeObserverViewport` from `src/runtime/viewport/useResizeObserverViewport.ts`

2. Replaced one-shot boxed viewport state path:
- removed local `setBoxedViewport(...)` one-shot layout effect
- added memoized fallback viewport:
  - `mode: 'boxed'`
  - `source: 'unknown'`
  - `1x1`, `dpr=1`
- added live hook call:
  - `useResizeObserverViewport(previewRootRef, { mode:'boxed', source:'container', fallbackViewport })`

3. Provider usage unchanged:
- `GraphViewportProvider` still wraps preview runtime subtree
- now receives live `boxedViewport` updates from hook

## Safety and scope

- Lease, portal scope, validation pipeline, and fallback UI logic remain unchanged.
- Portal root containment remains inside preview root as before.
- This run only changes viewport measurement feed.
