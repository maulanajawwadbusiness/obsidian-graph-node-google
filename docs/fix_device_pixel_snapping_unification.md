# Fix: Pixel Snapping Unification (Device Pixel Quantization)

**Date**: 2026-01-30
**Agent**: Antigravity
**Subject**: Device-Pixel Alignment & Render/Overlay Synchronization

## 1. Problem
User identified visual artifacts and interaction stability issues:
1.  **Cue Disagreement**: Overlays (Popups) and Rendered Nodes aligned differently because one snapped and the other didn't.
2.  **Sticky Motion**: Preemptive snapping of the Camera Pan caused "stair-step" motion during smooth drags.
3.  **Shimmer**: Lack of sub-pixel awareness (Device Pixel Ratio) caused aliasing on high-DPI screens.

## 2. Solutions

### A. Post-Projection Quantization (The "Late Snap")
*   **Change**: Removed all snapping logic from the `CameraTransform` matrix application. The Camera now operates in pure Float precision (fixing Sticky Motion).
*   **New Logic**: Snapping is applied *only* to the final Screen Coordinates just before drawing.
*   **Helper**: `quantizeToDevicePixel(px, dpr)` rounds to the nearest physical device pixel (`1/dpr` increments).

### B. Manual Projection for Canvas
*   **Change**: Refactored `graphDraw.ts` to stop relying on the Canvas Transformation Matrix (CTM) for positioning.
*   **Mechanism**:
    *   Links, Nodes, and Labels are manually projected using `worldToScreen`.
    *   The result is quantized.
    *   Drawing occurs in Identity Space (Screen Pixels).
*   **Benefit**: Ensures every visual element lands on a crisp pixel boundary.

### C. Unified Overlay Projection
*   **Change**: Updated `hoverController` (which powers `clientToWorld` and `PopupPortal`) to respect the same `pixelSnapping` flag and quantization logic.
*   **Fix**: Added `settingsRef` dependency to `createHoverController` so it knows the current policy.

## 3. Verification
*   [x] **Sticky Motion**: Removed snapping from `applyToContext`. Camera pans smoothly.
*   [x] **Cue Alignment**: `drawNodes` and `PopupPortal` now use the exact same `worldToScreen` math (including quantization).
*   [x] **High DPI**: Snapping uses `dpr` awareness (e.g. 0.5px steps on 2x screen), preventing "wobbly text" while maintaining crisp edges.

## 4. Code Changes
*   `src/playground/rendering/renderingMath.ts`: Added `quantizeToDevicePixel`.
*   `src/playground/rendering/camera.ts`: Removed internal snapping; added post-process snapping to `worldToScreen`.
*   `src/playground/rendering/graphDraw.ts`: Refactored to accept `worldToScreen` callback.
*   `src/playground/useGraphRendering.ts`: Disabled global CTM; wired up manual projection; passed `settingsRef` to controller.
