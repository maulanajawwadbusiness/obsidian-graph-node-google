# Repair Log: Gesture Disambiguation (Click vs Drag)
**Date**: 2026-01-30
**Status**: APPLIED
**Component**: `GraphPhysicsPlayground.tsx`

## The Issue
**Symptom**: "Grabbing" a node immediately triggered the Node Popup logic, preventing the user from dragging without an annoying overlay appearing.
**Root Cause**: The `onPointerDown` handler contained the `openPopup` call. In standard UI patterns, "Down" is ambiguous (could be click, could be drag). Only "Up" confirms the intent.

## The Fix
Implemented a standard **Delta-Threshold Gesture Recognizer**:

1.  **On Down**:
    *   Record `startX`, `startY`, `nodeId`.
    *   Initiate Physics Drag (`engine.grabNode`).
    *   **Do NOT** open popup.

2.  **On Up**:
    *   Calculate `delta = distance(currentPos, startPos)`.
    *   **If delta < 5px**: Treat as CLICK -> Open Popup.
    *   **If delta >= 5px**: Treat as DRAG -> Do nothing (Drag just ended).
    *   Release Physics Drag (`engine.releaseNode`).

## Code Changes
*   Removed `openPopup` from `onPointerDown`.
*   Added `gestureStartRef` to track state across events.
*   Consolidated `onPointerUp` logic to handle both "Release Drag" and "Check Click".
*   Verified restoration of `handleDragOver` and `handleDrop` which were briefly obstructed.

**Verification**:
*   **Drag**: Move mouse > 5px. Popup should NOT appear.
*   **Click**: Click and release without moving (or < 5px jitter). Popup SHOULD appear.
