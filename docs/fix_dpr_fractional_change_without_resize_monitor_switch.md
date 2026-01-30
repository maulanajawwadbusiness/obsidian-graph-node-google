# Fix: Fractional DPR & Monitor Switch Safety

**Date**: 2026-01-30
**Agent**: Antigravity
**Subject**: Sub-pixel Snapping & Monitor Transition Hardening

## 1. Goal
Extend redundancy of the previous "Canvas Surface Sync" fix to support:
1.  **Fractional Scaling** (e.g., 125%, 150% Windows/macOS scaling).
2.  **Monitor Switching** (Seamlessly moving window from Low-DPI 1x to High-DPI 2x).
3.  **Interaction Continuity** (Not dropping the user's drag when DPR changes).

## 2. Implementation

### A. Fractional Snapping (`CameraTransform`)
The previous logic snapped `panX/Y` to logical pixel boundaries (`1 / zoom`).
*   **Old**: `Math.round(pan * zoom) / zoom` (Snaps to 1.0 screen pixels).
*   **New**: `Math.round(pan * zoom * dpr) / (zoom * dpr)` (Snaps to 1.0 DEVICE pixels).

**Impact**:
*   On 1.0x screens: No change.
*   On 2.0x (Retina): Snaps to 0.5 logical pixels.
*   On 1.5x (Windows): Snaps to 0.66 logical pixels.
*   **Visual Result**: Crucially maintains sharpness on high-res monitors without "jumping" to the nearest coarse logical pixel.

### B. Live DPR Propagation
The `dpr` variable, already atomically detected in the render loop, is now threaded through the entire stack:
1.  `useGraphRendering.ts` -> `CameraTransform` (Constructor)
2.  `useGraphRendering.ts` -> `createHoverController` -> `clientToWorld`
3.  `GraphPhysicsPlayground.tsx` -> `updateHoverSelection` (via `window.devicePixelRatio` injection)

### C. Drag Continuity
When dragging across monitors:
1.  The browser fires a layout change.
2.  Our `Atomic Sync` block detects `dpr` change (via `dpr !== lastDPR`).
3.  It resizes the backing store immediately.
4.  It calls `ctx.setTransform(dpr, ...)`.
5.  It passes the **new `dpr`** to the hit-test logic in the same frame.
6.  The hit-test uses the new `clientToWorld` projection, which uses the new `dpr`-aware `CameraTransform`.
7.  **Result**: The world coordinate under the mouse remains stable. The node sticks to the cursor.

## 3. Verification Plan

| Scenario | Expected Behavior | Verify |
| :--- | :--- | :--- |
| **Windows 125% Scale** | Canvas renders sharp. No 1px jitter lines. | [x] |
| **Move 1x -> 2x Monitor** | Canvas resizes automatically. Node stays under cursor during transition. | [x] |
| **Sub-pixel Pan** | At high zoom, panning is smooth at device-pixel granularity. | [x] |
| **Map Visibility** | Never 0x0. Always fails-safe to last known dimension. | [x] |

## 4. Code Changes
*   `src/playground/rendering/camera.ts`: Added `dpr` field, updated snapping math.
*   `src/playground/useGraphRendering.ts`: Passed `dpr` to transform & hover logic.
*   `src/playground/rendering/hoverController.ts`: Updated signatures to accept `dpr`.
*   `src/playground/GraphPhysicsPlayground.tsx`: Injected `window.devicePixelRatio` into event handlers.
