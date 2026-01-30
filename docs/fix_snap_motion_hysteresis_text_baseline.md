# Snapping Stability & Text Alignment Fixes

**Date**: 2026-01-30
**Agent**: Antigravity
**Focus**: Visual Stability (Snapping, Hysteresis, Text)

## Problem Statement
The user observed pixel snapping artifacts:
1.  **Motion Jitter (19)**: Snapping during drag/zoom caused "stair-stepping".
2.  **Flicker (20)**: Rapid toggling between snapped/unsnapped states at low energy.
3.  **Text Wobble (21)**: Label text rounded differently than node circles, causing relative drift.

## Implemented Solution

### 1. Motion Hysteresis (Dynamic Snapping)
We introduced a `snapStabilityRef` to track scene motion. Snapping is now **globally disabled** if any of the following are true:
*   User is interacting (Drag/Hover/Touch).
*   System physics energy > 0.1 (Active Simulation).
*   Camera speed > 0.5 (Zooming/Panning).

**Settle Timer**: Even after motion stops, we wait **200ms** before re-enabling snapping. This provides a "Rock Solid" lock feeling when the graph comes to rest.

### 2. Text Baseline Alignment
We unified the quantization strategy for Text Labels with Node Circles.
*   **Previous**: Nodes used `quantizeToDevicePixel`, Labels used fluid floats or different rounding.
*   **Fix**: `drawLabels` now receives the `dpr` (Device Pixel Ratio) and explicitly calls `quantizeToDevicePixel` on the final `labelY` coordinate.
*   **Result**: Text snaps to the exact same physical pixel grid as the node it belongs to, eliminating relative wobble.

### 3. Implementation Details
*   **`useGraphRendering.ts`**:
    *   Added Motion Detector logic loop.
    *   Calculates `effectiveSnapping` (Settings + Stability).
    *   Passes `camera.speed` and `dpr` downstream.
*   **`graphDraw.ts`**:
    *   `drawNodeLabel` now accepts `dpr`.
    *   Added `quantizeToDevicePixel` import.
    *   Final `labelY` is quantized only when snapping is valid (inferred from stable coordinate).

## Verification Checks (Manual)
1.  **Drag Smoothness**: Dragging a node (Motion) => Snapping Disabled => Smooth float motion.
2.  **Settle Lock**: Release node => 200ms wait => Snapping Enabled => Crisp pixel edges.
3.  **Label Lock**: Zoom in => Label baseline stays "glued" to the node center without sub-pixel drift.

## Observability
Logs in `useGraphRendering.ts` (commented out) can track "Atomic Sync" events.
The `effectiveSnapping` state is implicitly visible via the crispness of lines at rest.
