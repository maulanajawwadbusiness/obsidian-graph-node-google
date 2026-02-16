# Step 7 Viewport Contract Report (Run 4)

Date: 2026-02-15
Focus: preview boxed viewport provider wiring (one-time snapshot only)

## Changed File
- `src/components/SampleGraphPreview.tsx`

## Wiring Applied
1. Added preview root ref:
- `previewRootRef` on outer preview root container.

2. Added boxed viewport state:
- initial safe fallback:
  - `mode='boxed'`
  - `source='unknown'`
  - `width=1`, `height=1`, `dpr=1`, `boundsRect=null`

3. One-time snapshot measurement in `useLayoutEffect`:
- reads preview root `getBoundingClientRect()` once after mount.
- sets viewport to:
  - `mode='boxed'`
  - `source='container'`
  - `width/height` from rect (min 1)
  - `dpr` from `window.devicePixelRatio`
  - `boundsRect` from rect values

4. Wrapped preview runtime subtree with:
- `<GraphViewportProvider value={boxedViewport}>...`

## Important Scope Note
- No `ResizeObserver` streaming was added in this run.
- This is contract plumbing only; step 8 will replace one-time snapshot with live resize updates.

## Behavior Impact
- Preview runtime and overlays continue to mount as before.
- Viewport context is now available in boxed mode for preview path.
