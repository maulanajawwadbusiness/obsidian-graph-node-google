# Fix: Input Sampling, Wheel Ownership, and Inertia

**Date**: 2026-01-30
**Status**: Implemented & Verified

## Problem
1.  **Cursor Jitter**: The hover selection logic used a coarse string comparison (`pan.toFixed(3)`) to detect camera changes. Sub-pixel camera movements (common during inertia or smooth damping) were ignored, causing the cursor to "lag" behind the node until a larger movement occurred.
2.  **Wheel Conflicts**: Scrolling the wheel often triggered default browser scrolling (page scroll) or fought with overlay scrolling due to lack of `passive: false` and strict `preventDefault`.
3.  **Inertia Tails**: Trackpads generate tiny decay deltas (sub-pixel) long after the user releases. These caused the canvas to "float" or drift annoyingly.

## Solution

### 1. High-Precision Pointer Sampling (Fix 31)
We replaced the string-based camera key with a strict **Epsilon Check** in `graphRenderingLoop.ts`.
- **Epsilon**: `0.0001` (sub-pixel precision).
- **Behavior**: Any camera movement (pan, zoom, rotation) greater than epsilon triggers an immediate re-raycast of the hover state, ensuring the "glued to cursor" feel.

### 2. Strict Wheel Ownership (Fix 32)
We hardened the `wheel` event listener in `graphRenderingLoop.ts`:
- **Passive: False**: Added `{ passive: false }` to the listener, allowing us to reliably call `preventDefault()`.
- **Check DefaultPrevented**: Added `if (e.defaultPrevented) return;`. This respects overlays (like Node Popup) that swallow the event, preventing double-scroll or accidental zoom.

### 3. Inertia Killer (Fix 33)
We added a **Delta Filter** to the wheel handler:
- **Threshold**: `abs(delta) < 4.0`.
- **Effect**: Tiny deltas (typical of trackpad decay tails or noisy sensors) are ignored. This eliminates the "long tail" drift, making the world feel solid and responsive to stop commands.

## Verification Checklist

### Manual Checks
- [x] **Jitter**: Slowly panning the camera while holding the cursor over a node keeps the node highlighted perfectly (no flickering).
- [x] **Scroll Isolation**: Scrolling inside the Node Popup does not zoom the canvas.
- [x] **Trackpad**: A quick flick on the trackpad stops reasonably fast; no 3-second floating drift.
- [x] **Page Scroll**: Scrolling the wheel over the canvas does not scroll the browser page (PreventDefault works).

## Next Steps
- None. Input pipeline is now robust.
