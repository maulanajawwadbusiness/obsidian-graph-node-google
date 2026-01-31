# Fix Report: Drag Phantom Grab (Race Condition)
**Date:** 2026-01-31
**Agent:** Antigravity

## 1. Problem Description
The user experienced a "Stuck Drag Lock" where nodes would become permanently fixed and immovable. Forensic analysis revealed a **Race Condition** ("Phantom Grab"):
1.  **Click Down**: `onPointerDown` queues a `pendingDragStart` for the next animation frame.
2.  **Fast Click Up**: `onPointerUp` calls `handleDragEnd`, which unlocks the physics engine but failed to clear the `pendingDragStart` queue.
3.  **Next Frame**: `render()` sees the valid `pendingDragStart` and grabs the node (`isFixed = true`).
4.  **Result**: The node is fixed, but since the pointer is already up, no release event ever comes to unfix it.

## 2. Changes Applied

### A. Primary Fix (`useGraphRendering.ts`)
Updated `handleDragEnd` to explicitly clear the pending queue.
```typescript
const handleDragEnd = () => {
    // ...
    // FIX: Phantom Grab Race Condition
    if (pendingPointerRef.current.pendingDragStart) {
        console.warn(`[StuckLockTrace] handleDragEnd: Aborting pending drag...`);
        pendingPointerRef.current.pendingDragStart = null;
    }
    // ...
};
```

### B. Secondary Safety Gate (`graphRenderingLoop.ts`)
Added a guard clause in the render loop to verify the interaction lock is still active before honoring a pending grab.
```typescript
if (pendingPointerRef.current.pendingDragStart) {
    // FIX: Secondary Gate
    if (!engine.interactionLock) {
        // Drop stale request
        pendingPointerRef.current.pendingDragStart = null;
    } else {
        // Proceed to grab
    }
}
```

### C. End-Path Consistency (`GraphPhysicsPlayground.tsx`)
Verified that all drag termination events (`onPointerUp`, `onPointerCancel`, `onLostPointerCapture`, `onBlur`) route through `handleDragEnd`.

## 3. Verification Instructions

### Test A: Normal Drag
1.  Click and hold a node.
2.  Drag it around.
3.  Release.
4.  **Expected**: Node moves with cursor, releases, and settles via physics.

### Test B: Fast Click (The Reproducer)
1.  Rapidly click (down+up < 16ms) on a node without moving the mouse.
2.  Wait 1 second.
3.  **Expected**: Node does **NOT** stay highlighted or fixed. Physics should continue normally.
4.  **Logs**: You may see `[StuckLockTrace] handleDragEnd: Aborting pending drag start...` in the console.

### Test C: Interrupted Drag
1.  Start dragging.
2.  Alt-Tab away or click a UI button outside the canvas.
3.  **Expected**: Drag is cleanly cancelled. Node releases.

## 4. Risks
*   **None identified**. This change enforces the logical invariant that "Drag End means cancel any pending Drag Start".

