# Fix Report: DPR & Backing Store Synchronization

**Date**: 2026-01-30
**Fix Target**: `canvas.width` (backing) vs `getBoundingClientRect` (layout) desynchronization on Zoom/Resize.

## 1. The Problem
Previously, the renderer polled for `dpr` changes inside the `render` loop. While this caught most cases:
1.  **Race Condition**: Sizing logic was interleaved with drawing logic.
2.  **No Event Trigger**: It relied solely on `requestAnimationFrame`, meaning a resize while the tab was backgrounded (throttled rAF) could leave the backing store stale until the next tick.
3.  **Code Duplication**: Sizing logic was inline, making it hard to ensure `ctx.setTransform` was *always* called immediately after a resize (context reset hazard).

## 2. The Solution
We implemented a **Centralized Idempotent Sizing Function** (`syncCanvasSizing`) and wired it to multiple triggers.

### A. Centralized Logic (`src/playground/rendering/canvasUtils.ts`)
```typescript
export function syncCanvasSizing(canvas, ctx, lastDPRRef, debug) {
    // 1. Read Truth
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // 2. Compute Target Backing Size
    const displayWidth = Math.round(rect.width * dpr);
    const displayHeight = Math.round(rect.height * dpr);

    // 3. Detect Mismatch
    if (canvas.width !== displayWidth || canvas.height !== displayHeight || lastDPR !== dpr) {
        // 4. Apply Resize
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        
        // 5. CRITICAL: Restore Context
        // Resize clears the context. We must restore the transform immediately.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return true;
    }
    return false;
}
```

### B. Wired Triggers (`src/playground/useGraphRendering.ts`)

1.  **Frame Loop (rAF)**:
    *   Calls `syncCanvasSizing` at the start of *every* frame.
    *   Guards against "Stretchy Frame" visuals by fixing the backing before any drawing occurs.
    *   Updates `engine.worldBounds` (Physics Wall) if size changed.

2.  **ResizeObserver**:
    *   **New**: Added a `ResizeObserver` to the canvas.
    *   **Effect**: Even if the animation loop is paused or throttled, a layout change (CSS resize) immediately triggers a backing store sync. This prevents the "Blurry Stretch" effect when resizing a paused graph.

## 3. Verification Steps (Manual)

1.  **Zoom Test (Ctrl +/-)**:
    *   Browser Zoom changes `window.devicePixelRatio`.
    *   `syncCanvasSizing` detects `dpr` mismatch.
    *   `canvas.width` updates to `rect * newDpr`.
    *   `ctx.setTransform` updates to new scale.
    *   **Result**: Graph remains sharp and 1:1 with cursor.

2.  **Resize Test (Panel Toggle)**:
    *   Layout changes `rect.width`.
    *   `ResizeObserver` fires -> Calls `syncCanvasSizing`.
    *   Backing store updates.
    *   **Result**: No stretching or skewing.

3.  **Context Safety**:
    *   We verified that `ctx.setTransform(dpr...)` is called:
        a) Inside `syncCanvasSizing` (immediately after resize).
        b) Inside `render` loop (unconditionally every frame).
    *   **Result**: No "Identity Transform" bugs where drawings appear tiny (unscaled).

## 4. Architectural Safety
*   **Idempotency**: The function is cheap to call 60 times a second (simple integer comparisons).
*   **Guard Rails**: `lastDPR` ref ensures we catch cross-monitor moves.
*   **Debug**: Added `[Resync]` log to confirm when this actually fires.

## 5. Files Changed
*   `src/playground/rendering/canvasUtils.ts` (New Helper)
*   `src/playground/useGraphRendering.ts` (Integration)
