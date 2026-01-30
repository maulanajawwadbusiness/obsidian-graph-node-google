# Forensic Report: Hover Dead / Event Starvation Fix

## Symptom
Hover debug logs (`[HoverDbg]`) were completely missing, indicating `updateHoverSelection` was never called, despite `hoverDebugEnabled` being true.
Detailed logging confirmed that `DOM PointerMove` events were arriving, but the internal Logic Gate was failing to trigger updates.

## Root Cause Analysis
1.  **Pointer ID Deadlock**:
    - `hoverController` enforced strict "Single Active Pointer" ownership.
    - If a pointer (e.g., touch or previous mouse session) was tracked but never released (missed `pointerup`/`pointercancel`), `activePointerId` stayed stuck.
    - Subsequent mouse moves (with different ID) were ignored.
    - Result: Hover logic dead.

2.  **Event Pipeline Fragility**:
    - `graphRenderingLoop` relied strictly on `pendingPointer` flag.
    - If `handlePointerMove` returned early (due to deadlock), `pendingPointer` was never set.
    - Loop never updated hover.

## Fixes Implemented

### 1. Deadlock Breaker (`hoverController.ts`)
- Modified `handlePointerMove` to allow `mouse` input to "steal" ownership from a stuck ID, strictly if **no drag operation is active**.
- This ensures Mouse is always responsive even after ghost touches.

### 2. Robustness Heartbeat (`graphRenderingLoop.ts`)
- Added a 10Hz "Heartbeat" to `updateHoverSelectionIfNeeded`.
- Even if `pendingPointer` is false (e.g., mouse stopped), the loop will re-evaluate hover every ~100ms.
- This fixes "Camera Move" hover updates (where mouse is still but world moves) and recovers from any dropped event flags.

### 3. Verification Logs
- Added `[HoverDbg]` to Window, DOM, and Logic layers for immediate runtime proof of life.

## Validated Behavior
- Window events -> DOM events -> Handler (Deadlock check) -> Loop (Heartbeat) -> Update.
- Chain is now robust against single-point failures.
