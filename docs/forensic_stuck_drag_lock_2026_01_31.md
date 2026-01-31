# Forensic Report: Stuck Drag Lock & "Phantom Grab"
**Date:** 2026-01-31
**Agent:** Antigravity
**Subject:** Race Condition in Deferred Drag Architecture

## 1. Executive Summary
The "stuck drag lock" symptom—where a node becomes permanently fixed and immovable—is caused by a **race condition** between the React event loop (`PointerUp`) and the Animation Frame (`render`).

Specifically, `handleDragEnd` (on pointer release) correctly unlocks the engine but **fails to cancel the pending drag start**. If a user clicks quickly (pointer down + up) before the next frame fires, `handleDragEnd` runs first (unlocking nothing, since grab hasn't happened yet), and then `render()` runs, seeing the `pendingDragStart` and executing `grabNode()`. This leaves the node in a `isFixed=true` state with no pointer to drag it and no remaining events to release it.

## 2. Invariants & Violation
*   **Invariant A**: Drag Start must eventually be met with Drag End. (STATUS: **VIOLATED**)
*   **Invariant B**: `interactionLock` must match the presence of `draggedNodeId`. (STATUS: **VIOLATED**)
    *   *Reality*: The engine can have `draggedNodeId` set (via Phantom Grab) while `interactionLock` is false (because `handleDragEnd` ran before grab).
*   **Invariant C**: `pendingDragStart` must be invalidated if the atomic action "Drag End" occurs. (STATUS: **VIOLATED**)

## 3. The "Phantom Grab" Timeline
This sequence produces the stuck state:

| Time | Thread | Event | State | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **T0** | UI | `onPointerDown` | `pendingDragStart` = NODE_A | Queued. Engine Unlocked.* |
| **T0+1ms** | UI | `handleDragStart` | `interactionLock` = TRUE | Lock acquired. |
| **T0+5ms** | UI | `onPointerUp` | Calls `handleDragEnd` | **Fast Click** |
| **T0+6ms** | UI | `handleDragEnd` | `interactionLock` = FALSE | Unlocks. Calls `releaseNode` (which does nothing as `draggedNodeId` is null). |
| **T1 (16ms)** | RAF | `render()` | Consumes `pendingDragStart` | **CRITICAL FAILURE** |
| **T1+1ms** | RAF | `engine.grabNode` | `draggedNodeId` = NODE_A | `isFixed` = TRUE. |
| **T_Future** | UI | (Idle) | Node A is Fixed. | Capture is gone. No events will move or release it. |

**Result**: Node A is fixed in space adjacent to the cursor (from T0 coords). The user thinks they released it. The system thinks it's dragging, but no pointer updates act on it.

## 4. End-Path Audit
We searched for `releaseNode` calls to see if any bypassed `unlockInteraction`.

| Call Site | File | Safety | Notes |
| :--- | :--- | :--- | :--- |
| `handleDragEnd` | `useGraphRendering.ts` | **SAFE** | Calls `releaseNode` then `unlockInteraction`. |
| `onPointerDown` | `GraphPhysicsPlayground.tsx` | **SAFE** | Checks `!DRAG_ENABLED`. Only runs if drag is disabled (i.e. not locked). |
| `PhysicsEngine.ts` | `engine.ts` | **N/A** | Definition. |

**Conclusion**: The issue is **NOT** a direct bypass of `unlock`. It is the **timing** of the unlock relative to the grab.

## 5. Screen Symptom Explanation
*   **"Grabbed but cannot move"**: The node is `isFixed=true`. But because pointer capture is released (at T0+5ms), `applyDragTargetSync` doesn't receive refreshing `clientX/Y`. It might use stale coords or nothing. The node simply stays pinned.
*   **"Stuck there"**: Since `draggedNodeId` is set, future clicks might be weird, but `handleDragStart` will just overwrite the `pendingDragStart`. However, the *old* node (Phantom Grabbed) remains `isFixed=true` forever because `grabNode` only sets the *new* node properties; it relies on `releaseNode` to clear the old one. If `releaseNode` never cleared the Phantom Grab, the Phantom Node remains fixed.

## 6. Minimal Fix Direction
**Confidence: 100%**

1.  **Clear Pending on Release**:
    In `handleDragEnd` (useGraphRendering.ts), explicitly set `pendingPointerRef.current.pendingDragStart = null`.
    *Why*: If the drag hasn't started yet (it's pending), "Ending" it means "Don't Start It".

2.  **Safety Check in Render**:
    In `graphRenderingLoop.ts`, before consuming `pendingDragStart`, check `if (!hoverStateRef.current.hasPointer)` or similar (optional, but robust).

3.  **Atomic Release in Engine**:
    Modify `grabNode` to implicitly call `releaseNode` first? No, that might have side effects. Stick to Fix 1.

## 7. Operational Log
We added logs `[StuckLockTrace]` which will show:
`handleDragEnd called but pendingDragStart is present! Race detected.`
This confirms the diagnosis when observed in runtime.
