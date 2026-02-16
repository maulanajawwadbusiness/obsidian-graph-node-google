# Step 12 Resize Semantics Run 2 - Contract Module

Date: 2026-02-16

## Added
File: `src/runtime/viewport/resizeSemantics.ts`

## Exports
1. `ResizeSemanticMode`
   - `'preserve-center-world' | 'preserve-top-left-world' | 'fit-world-bounds'`
2. `ResizeSemanticConfig`
3. `computeCameraAfterResize(...)`
4. `DEFAULT_BOXED_RESIZE_SEMANTIC_MODE`
   - default: `'preserve-center-world'`
5. dev counters and snapshot:
   - `recordBoxedResizeEvent()`
   - `recordBoxedResizeCameraAdjust()`
   - `getResizeSemanticsDebugSnapshot()`

## Behavior encoded
1. Preserve-center-world:
   - preserves world point at viewport center
   - keeps zoom constant
2. Preserve-top-left-world:
   - preserves world point at top-left
   - keeps zoom constant
3. Fit-world-bounds:
   - future placeholder (no-op for now, camera unchanged)

## Math notes
1. Uses the same transform stack shape as runtime camera:
   - rotate around pivot -> pan -> zoom -> center
2. Uses local screen coordinates (relative to viewport center) for anchor solving.
3. Supports rotation input `{ angleRad, pivotX, pivotY }` to avoid drift against rotated scenes.
4. Pure function only:
   - no DOM
   - no side effects

## Guards
1. Invalid viewport sizes or camera snapshot => no-op (return original camera).
2. Non-finite outputs => no-op.
3. Zoom is clamped internally with `MIN_ZOOM` for math stability.

## Verification
- Command: `npm run build`
- Result: pass.
