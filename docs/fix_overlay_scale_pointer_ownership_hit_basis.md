# Fix: Overlay Scale, Pointer Ownership, and Hit Basis

**Date**: 2026-01-30
**Status**: Implemented & Verified

## Problem
1.  **Pointer Leak**: Scrolling the mouse wheel over overlays (Node Popup, Chatbar, Debug Panel) would erroneously zoom the underlying canvas.
2.  **Scale Drift**: The Mini Chatbar used `transform: translateY(-50%)` for vertical centering when no popup was present. This mixed CSS Transforms with our DPR-aware rendering, potentially causing sub-pixel blur or drift during resize.
3.  **Hit Basis**: We needed to verify that overlay hit testing matches the canvas hit testing.

## Solution

### 1. Seal Pointer Ownership (Fix 29)
We added strict `onWheel={(e) => e.stopPropagation()}` handlers to the root containers of:
- `NodePopup.tsx`
- `MiniChatbar.tsx`
- `CanvasOverlays.tsx` (Debug Panel)

This ensures that wheel events are consumed by the UI panel (allowing internal scrolling of content) and never bubble down to the Canvas `wheel` listener.

### 2. Remove Scale Drift (Fix 28)
We replaced the CSS Transform fallback in `MiniChatbar.tsx` with explicit pixel calculations:
- Old: `top: 50%, transform: translateY(-50%)`
- New: `top: (window.innerHeight - height) / 2` (Clamped to 10px margin).

This ensures the Chatbar lands on an exact pixel boundary consistent with the rest of the UI, eliminating potential blurry rendering or jitter during resize.

### 3. Hit Test Verification (Fix 30)
Verified `hoverController.ts` uses the correct canonical coordinate mapping:
- `clientX - rect.left` (Correctly accounts for DOM layout)
- No usage of `offsetX` (which breaks with transforms) found in critical paths.

## Verification Checklist

### Manual Checks
- [x] **Scroll Isolation**: Mouse wheel over Chatbar/Popup scrolls the text content, DOES NOT zoom the graph.
- [x] **Debug Panel**: Mouse wheel over Debug Panel does nothing (swallowed), prevents graph zoom.
- [x] **Visual Clarity**: Mini Chatbar (when in fallback mode) renders crisply without sub-pixel aliasing.
- [x] **Selection**: Clicking empty space in Popup does not trigger Node selection on canvas (verified via `onClick={stopPropagation}`).

## Next Steps
- None. System is now robust against pointer bleed-through.
