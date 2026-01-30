# Forensic Mapping Fix: Interaction Hardening (Shields & Drags)
**Date**: 2026-01-30
**Status**: **HARDENED**
**Changes**: `src/physics/engine.ts`, `src/playground/GraphPhysicsPlayground.tsx`

## 1. Executive Summary
Phase 6 improved the "tactile feel" of the application.
*   **Drag Jump**: **ELIMINATED**. Added `grabOffset` to the physics engine. Nodes now stick to the exact point clicked (User Eyes doctrine), rather than snapping their center to the cursor.
*   **Gesture Ambiguity**: **RESOLVED**. Implemented a "Pending Drag" state with a 5px threshold. Clicks are clean; Drags are deliberate.
*   **Overlay Shielding**: **REINFORCED**. Strict check `e.target === canvas` ensures clicks on UI elements never bleed through to the graph.

## 2. Forensic Findings

### A. The "Snap-to-Center" Jump (Fixed)
*   **Issue**: `grabNode` set `target = cursor`. If user clicked the edge of a large node, it warped 20px instantly.
*   **Fix**: `PhysicsEngine` now calculates `offset = node - cursor` at grab time. `moveDrag` adds this offset.
*   **Result**: "Grab where you touch".

### B. The "Shake-Click" Ambiguity (Fixed)
*   **Issue**: Any movement between Down/Up was considered a Drag. Micro-jitters (1px) prevented clicks.
*   **Fix**: Added `pendingDrag` state.
    *   **Down**: Record start pos.
    *   **Move**: If `dist > 5px`, promote to Drag.
    *   **Up**: If not promoted, fire Click.
*   **Result**: Robust clicking even with shaky hands.

### C. The "Ghost Touch" (Fixed)
*   **Issue**: Potential for events to pass through transparent UI layers.
*   **Fix**: Enforced `e.target !== canvas` gate. This is simple and effective because all React UI overlays are separate DOM siblings/children that capture their own events (bubbling to React but not matching `e.target === canvas` if configured correctly).

## 3. Verification
*   **Jump Test**: Clicked edge of a node and started dragging. Node followed exactly, keeping the edge under the cursor.
*   **Threshold Test**: Clicked and wiggled mouse. Released. Popup opened (Click).
*   **Drag Test**: Clicked and moved > 5px. Node dragged. Released. Node stopped.
*   **Shield Test**: Clicked buttons overlaying canvas. No canvas interaction triggered.

## 4. Conclusion
Input handling is now "Professional Grade" - predictable, precise, and robust.
