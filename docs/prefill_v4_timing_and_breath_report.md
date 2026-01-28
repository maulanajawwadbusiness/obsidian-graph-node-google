# Prefill System V4: Timing & Breath

## Overview
Added a "breath" phase between seed and refinement to create a calmer, more confident prefill experience. Streaming now uses an ease-out curve.

## Changes
1.  **Phased Streaming**:
    -   `SEED`: Streams `In context of "${nodeLabel}", continuing...` over ~500ms using ease-out (fast start, slow end).
    -   `BREATH`: A 500ms silence where no text changes occur. This prevents the "rushed" feeling.
    -   `REFINE`: Streams the AI suggestion over 700-1200ms (depending on length) using ease-out.

2.  **Streaming Logic**:
    -   Updated `startStreaming` to support custom durations and ease-out curves.
    -   Added `phaseRef` to track `idle | seed | breath | refine | waiting`.
    -   Ensures refined prompt doesn't interrupt the "breath" phase.

3.  **Cancellation**:
    -   Any user typing immediately stops all streaming and cancels pending phases.
    -   Breath timeout is cleared on interruption.

## Timing
-   **Seed**: 500ms duration.
-   **Breath**: 500ms pause.
-   **Refine**: 700ms - 1200ms duration (dynamic based on length).

## Verification Checklist (Manual)
-   [ ] **Flow**: Handoff -> Fast Seed -> Pause (Breath) -> Gentle Refine.
-   [ ] **Feel**: Should feel like the system is "placing" the text confidently, not typing mechanically.
-   [ ] **Interruption**: Typing during Seed, Breath, or Refine stops everything instantly.

## Logs
-   `[Prefill] stream_start mode=seed|refine`
-   `[Prefill] phase=breath duration=500ms`
-   `[Prefill] refine_ready apply=DELAY reason=breathing` (if applicable)
