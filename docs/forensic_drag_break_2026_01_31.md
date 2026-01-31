# Forensic Report: Node Drag Critical Failure
**Date:** 2026-01-31
**Agent:** Antigravity
**Subject:** Investigation of Broken Node Drag (Post-Unification)

## 1. Executive Summary
The node drag functionality is **dead** because the "Deferred Drag" logic (Fix 36) was implemented in the backing hook (`useGraphRendering`) but **never wired** into the main UI component (`GraphPhysicsPlayground`).

The code explicitly comments out the old `grabNode` call with a TODO to use the new logic, but the new logic invocation is missing. Additionally, the `safeEndDrag` pattern has been lost, leading to potential "stuck lock" states where the physics engine remains in `drag` mode indefinitely if a drag is cancelled.

## 2. Root Cause Analysis

### A. The missing Link (GraphPhysicsPlayground.tsx)
In `src/playground/GraphPhysicsPlayground.tsx`, the `onPointerDown` handler correctly captures the pointer but fails to initiate the drag.

**Location:** `src/playground/GraphPhysicsPlayground.tsx` (Lines 197-217)
```typescript
if (hitId) {
    // FIX 36: Deferred Drag Start (First Frame Continuity)
    // Don't grab immediately. Queue it for the next render tick.
    // ...
    // const { x, y } = clientToWorld(e.clientX, e.clientY, rect);
    // engineRef.current.grabNode(hitId, { x, y }); <-- COMMENTED OUT
    if (DRAG_ENABLED) { 
        // ... (Empty Block)
        // Better: `startGraphDrag(nodeId, clientX, clientY)` exposed from hook.
    }
}
```

### B. The Unused Implementation (useGraphRendering.ts)
The necessary logic **exists** in `src/playground/useGraphRendering.ts`.
*   `handleDragStart`: Sets `pendingPointerRef.current.pendingDragStart` and locks interaction.
*   `handleDragEnd`: Releases node and unlocks interaction.
*   Both functions are returned by the hook but **ignored** by the consumer.

### C. The "Safe End" Regression
The system documentation mentions a centralized `safeEndDrag`. This is missing.
Current implementation in `GraphPhysicsPlayground` calls `engine.releaseNode()` directly:
```typescript
const onPointerCancel = (e: React.PointerEvent) => {
    // ...
    engineRef.current.releaseNode(); // <-- UNSAFE: Does not call unlockInteraction()
};
```
This bypasses `handleDragEnd`, which means `engine.interactionLock` ("drag") is never cleared after a drag ends. This can leave the engine permanently in "Interaction Mode" (preventing degrade/optimization).

## 3. Findings Summary

| Component | Status | Issue |
| :--- | :--- | :--- |
| **Pointer Capture** | ✅ OK | `canvas.setPointerCapture` is called correctly. Events `pointermove`/`pointerup` fire. |
| **Logic Wiring** | ❌ BROKEN | `onPointerDown` does practically nothing. `grabNode` is commented out. |
| **Safety Rails** | ⚠️ COMPROMISED | `lastEndDrag` logic is missing. Direct `releaseNode` calls bypass `unlockInteraction`. |

## 4. Recommended Repair

1.  **Expose Handlers**: In `GraphPhysicsPlayground.tsx`, destructure `handleDragStart` and `handleDragEnd` from `useGraphRendering`.
2.  **Wire Start**: Call `handleDragStart(hitId, e.clientX, e.clientY)` in `onPointerDown`.
3.  **Wire End**: Replace ALL calls to `engineRef.current.releaseNode()` with `handleDragEnd()` (in `onPointerUp`, `onPointerCancel`, `onLostPointerCapture`, `onBlur`).

 This will restore "Knife-Sharp" dragging and ensure the interaction lock is properly managed.
