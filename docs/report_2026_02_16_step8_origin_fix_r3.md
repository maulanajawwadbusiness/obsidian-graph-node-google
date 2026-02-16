# Step 8 Origin Fix Run 3 - Multi Entry and RO Size Hardening

Date: 2026-02-16
Run: r3
Scope: harden ResizeObserver callback entry selection and size extraction semantics.

## Changes

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. Multi-entry callback selection:
   - added `pickEntryForTarget(entries, target)`.
   - callback now prefers the entry that matches current observed element.
2. Size extraction fallback chain:
   - added `readObserverSize(entry)`.
   - prefers `contentBoxSize` (`inlineSize` / `blockSize`) when available.
   - falls back to `entry.contentRect.width/height`.
3. Origin source remains fixed:
   - no use of `contentRect.left/top`.
   - origin still resolved from active element BCR in flush.

## Outcome

- callback is robust to multi-entry delivery.
- sizing path is browser-compatible while keeping RO as primary size source.

## Verification

- `npm run build` passes.
