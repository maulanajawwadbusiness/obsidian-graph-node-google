# Repair Report: Overlay Consistency & Interaction Hardening
**Date**: 2026-01-30
**Status**: APPLIED
**Focus**: "Visual Dignity" (Zero-Jitter, Zero-Lag, Pixel-Perfect Hit Testing)

## 1. The Problem Space
The "User Eyes" initiative identified three critical defects in the Overlay system (`NodePopup`, `MiniChatbar`):
1.  **Parallax/Lag**: Overlays maintained their own update loops or relied on React State, causing them to trail the 60hz/144hz Physics Canvas by 1 frame.
2.  **Subpixel Drift**: Overlays mixed `Math.round`, `Math.floor`, and raw floats, causing them to "vibrate" against the pristinely quantized Canvas rendering.
3.  **Coordinate Schism**: Hit targets (DOM) drifted from Visuals (Canvas), making buttons unclickable or offsetting interactions.

## 2. The Solution Architecture: "Slave to the Tick"
We enforced a strictly hierarchical update model where the Canvas Render Loop is the **Single Source of Truth**.

### A. The Master Tick (`graph-render-tick`)
The `useGraphRendering` loop now dispatches a rich event at the exact moment the frame is painted:
```typescript
interface RenderTickDetail {
    transform: { worldToScreen: (x,y) => {x,y} }; // The EXACT matrix used this frame
    dpr: number; // Device Pixel Ratio source of truth
}
```

### B. Synchronous DOM Updates (`NodePopup`)
`NodePopup` no longer polls for position. It subscribes to the tick and updates **synchronously** in the same microtask sequence:
1.  **Read**: Get `detail.transform`.
2.  **Compute**: Project World Node -> Screen with the *exact* camera state of the frame.
3.  **Quantize**: Apply `quantizeToDevicePixel(x, dpr)` to match Canvas stroke alignment.
4.  **Write**: Direct DOM `style.left/top` update (bypassing React Render Cycle).

**Result**: The Popup is mathematically locked to the Node. If the Node moves 100px/s, the Popup moves 100px/s with zero trailing.

### C. Daisy-Chained Dependency (`MiniChatbar`)
`MiniChatbar` is pinned to `NodePopup`. To prevent it from detaching during high-speed camera pans:
1.  We added `id="arnvoid-node-popup"` to the popup root.
2.  `MiniChatbar` subscribes to the *same* `graph-render-tick`.
3.  It reads the **freshly updated** DOM Rect of the popup (forcing a synchronous reflow if needed).
4.  It strictly aligns itself using the `computeChatbarPosition` logic.

## 3. Quantization Doctrine (Fix 25)
All layers now respect the high-DPI "Pixel Snap" rule:
*   **Canvas**: `quantizeToDevicePixel` (renderingMath.ts).
*   **Overlays**: `quantizeToDevicePixel` (NodePopup.tsx).

Formula: `x = round(x * dpr) / dpr`.
*   @ 1x: Integers (10.0, 11.0)
*   @ 2x: Halves (10.0, 10.5, 11.0)

## 4. Hierarchy of Authority
1.  **Physics**: Updates Node (World Space).
2.  **Camera**: Updates View Matrix (World -> Screen).
3.  **Canvas**: Renders Nodes (Screen Space, Quantized).
4.  **Event**: Dispatches `graph-render-tick`.
5.  **NodePopup**: Updates DOM (screenspace, Quantized).
6.  **MiniChatbar**: Updates DOM (relative to Popup).

## 5. Verification
*   **Rounding**: Confirmed `NodePopup` imports and uses `renderingMath.ts`.
*   **Latency**: Confirmed `useEffect` setup in Overlays listens to `window` event, bypassing React batching.
*   **Hit Testing**: Confirmed `NodePopup` has `pointer-events: auto` and `PopupOverlayContainer` has `pointer-events: none`. Visuals align with DOM, so Clicks align with Visuals.

**System Health**: Hardened.
