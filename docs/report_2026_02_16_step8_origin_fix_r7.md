# Step 8 Origin Fix Run 7 - Docs Sync for Origin Truth

Date: 2026-02-16
Run: r7
Scope: update system documentation so viewport origin and size semantics match the implemented hook.

## Docs updates

File: `docs/system.md` (Section `2.10 Graph Viewport Contract`)

1. Added explicit origin truth:
   - origin (`left/top`) comes from element `getBoundingClientRect()`.
2. Added explicit size precedence:
   - prefer ResizeObserver `contentBoxSize` when available.
   - fallback to `contentRect.width/height`.
   - fallback to BCR size as last resort.
3. Added dependency note:
   - step 9 boxed clamp/origin correctness depends on step 8 BCR-origin truth.

## Browser compatibility note

- `contentBoxSize` is optional; hook fallback path keeps compatibility on environments where only `contentRect` size exists.

## Verification

- `npm run build` passes.
