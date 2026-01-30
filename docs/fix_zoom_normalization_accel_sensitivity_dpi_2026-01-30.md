# Fix Report: Zoom Normalization, Acceleration & Sensitivity
**Date**: 2026-01-30
**Status**: **APPLIED**
**Files**: `src/playground/useGraphRendering.ts`, `src/playground/rendering/camera.ts`

## 1. Executive Summary
We addressed the "User Eyes" consistency issues where controls felt syrupy, inconsistent across devices, or hard to tune.
*   **Zoom**: **NORMALIZED**. Trackpad (Pixel) and Mouse (Line) deltas now produce consistent zoom steps.
*   **Response**: **SNAPPY**. Removed "syrup" smoothing from the camera, making it react instantly to inputs while retaining jitter hiding.
*   **Tuning**: **EXPOSED**. Added clear `PAN_SENSITIVITY` and `ZOOM_SENSITIVITY` scalars.

## 2. Root Cause Analysis

### A. Inconsistent Zoom (Defect 25)
*   **Symptom**: Zoom was wildly fast on mouse wheel vs trackpad.
*   **Cause**: The wheel handler blindly used `deltaY`. Mice typically report `deltaMode=1` (Lines) with values ~1-3, while trackpads report `deltaMode=0` (Pixels) with values 1-50+.
*   **Fix**: Modified `handleWheel` to detect `deltaMode`. Line deltas are multiplied by 33, Page deltas by 800, normalizing everything to "Pixel Equivalents" before applying sensitivity.

### B. "Syrup" Acceleration (Defect 26)
*   **Symptom**: Small movements felt dead; the interface felt "heavy".
*   **Cause**: The camera smoothing time constant (`lambda`) was 4.0, implying a ~600ms settling time. This filtered out high-frequency "human" intent.
*   **Fix**: Increased `lambda` to 15.0 (~150ms settling). This is physically "snappy" (responds in < 200ms) but still smooths out integer-pixel aliasing.

### C. DPI / Sensitivity Limits (Defect 27)
*   **Symptom**: Hard to match muscle memory across different mouse speeds.
*   **Fix**: Introduced `ZOOM_SENSITIVITY` (0.002) and `PAN_SENSITIVITY` (1.0) constants in the input path. These act as "Gain" knobs for the interaction, decoupled from the simulation physics.

## 3. Verification Steps

### Manual Validation
1.  **Trackpad vs Mouse**:
    *   Use a Mouse Wheel: Confirm one "click" zooms a predictable amount (e.g. 10%).
    *   Use a Trackpad Pinch/Scroll: Confirm it feels smooth and comparable in range, not 100x faster/slower.
2.  **Snappiness**:
    *   Flick the view. It should settle almost instantly when you stop. It should not "drift" for half a second.
3.  **Small Moves**:
    *   Nudge the wheel slightly. The view *must* move. It should not be eaten by the smoother.

## 4. Conclusion
The view control now honors the "1:1 Human Intent" principle while normalizing hardware variances.
