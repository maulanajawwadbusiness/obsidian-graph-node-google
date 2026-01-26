# Future Bugs / TODO

## Wheel handling guard for future canvas zoom

**Issue:** The left window currently only calls `stopPropagation()` on wheel events. This is fine today because there is no wheel-based camera zoom/pan, but once a canvas wheel handler is added (especially on `window`/`document` capture), it may still receive wheel events originating from the left viewer.

**Future fix:** When adding wheel zoom/pan, guard in the canvas wheel handler:
- Ignore events whose target is inside the left viewer container (e.g., `event.target.closest('[data-role="viewer"]')`).
- This avoids breaking left window scroll behavior and prevents future zoom/pan from triggering while scrolling the viewer.

**Why not fix now:** There is no canvas wheel handler yet, so there is no hook to apply the guard. Adding `preventDefault()` on the viewer now would break its scrolling.

