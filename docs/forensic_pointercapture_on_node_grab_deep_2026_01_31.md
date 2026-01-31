# Forensic Report: Pointer Capture & Node Grab Deep Scan
**Date:** 2026-01-31
**Agent:** Antigravity
**Ground Truth Commit:** `7a77254f61ca4d31b853d5ae101ce31c`

## 1. Executive Summary
The "stuck drag lock" issue—where a node is grabbed but refuses to move—is likely caused by a **race condition** in the "Deferred Drag" mechanism where the `pendingDragStart` is consumed *after* `clientToWorld` has potentially drifted or the pointer has moved significantly without an update, OR the interaction lock is set but the `engine.moveDrag` loop is receiving stale coordinates due to `hoverStateRef` desync.

Crucially, **Pointer Capture** is requested immediately in `onPointerDown`, but the actual drag start (physics grab) is deferred to the next render frame. If the pointer moves or releases *between* the click and the frame, the `pendingDragStart` data might be stale or the capture already lost.

We have wired surgical logs (prefixed `[PointerTrace]`) to confirm this hypothesis in runtime.

## 2. Pointer Capture "Chain of Custody"
This table tracks who owns the pointer and who is assumed to own it.

| Step | Function | File | Line | Capture Reality | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0. Click** | `onPointerDown` | `GraphPhysicsPlayground.tsx` | 179 | **Requested** | `canvas.setPointerCapture(e.pointerId)` |
| **1. Locate** | `updateHoverSelection` | `GraphPhysicsPlayground.tsx` | 188 | **Assumed** | Calculates hit based on `clientToWorld` |
| **2. Queue** | `handleDragStart` | `useGraphRendering.ts` | 185 | **Ignored** | Sets `pendingPointerRef`. Capture status irrelevant here. |
| **3. Lock** | `handleDragStart` | `useGraphRendering.ts` | 183 | **Irrelevant** | `engine.lockInteraction('drag')`. Locks optimizations. |
| **4. Render** | `render()` | `graphRenderingLoop.ts` | 834 | **Assumed** | Checks `pendingDragStart`. **CRITICAL GAP**: Does NOT check if capture still held. |
| **5. Grab** | `engine.grabNode` | `graphRenderingLoop.ts` | 838 | **Irrelevant** | Physics update. Sets `draggedNodeId`. |
| **6. Sync** | `applyDragTargetSync` | `graphRenderingLoop.ts` | 1068 | **Required** | Reads `hoverStateRef.cursorClientX`. Needs valid pointer events updating this. |
| **7. Release**| `onPointerUp` | `GraphPhysicsPlayground.tsx` | 212 | **Released** | `canvas.releasePointerCapture`. |

## 3. The "Silent Break" Moment
The critical failure path identified is between **Step 4 (Render)** and **Step 6 (Sync)**.

*   **Logic**: `render()` consumes `pendingDragStart` and calls `grabNode`.
*   **Gap**: `applyDragTargetSync` (later in `render`) relies on `hoverStateRef` being updated by `handlePointerMove`.
*   **Failure Mode**: If `onPointerMove` is NOT firing (e.g., lost capture, or throttling checks fail), `applyDragTargetSync` uses *old* coordinates. The node is "grabbed" (fixed) but stays at the initial click position forever.

**Why it feels like "Stuck Lock":**
1.  `handleDragStart` sets `engine.interactionLock = 'drag'`.
2.  `grabNode` sets `node.isFixed = true`.
3.  `moveDrag` logic fails to receive new X/Y. Node stays still.
4.  User releases → `onPointerUp` fires → `releaseNode` + `unlockInteraction`.
5.  **BUT**, if the capture was lost silently (e.g., clicking a specific overlay), `onPointerUp` might never fire on the canvas. The engine remains LOCKED forever.

## 4. Verification Logs (Instrumentation Added)
We have injected `[PointerTrace]` logs to confirm this sequence:

1.  **Down**: `[PointerTrace] Down id=1 captured=true target=CANVAS`
2.  **Queue**: `[PointerTrace] Queueing DragStart for node-123`
3.  **Lock**: `[PointerTrace] handleDragStart: locked interaction`
4.  **Render**: `[PointerTrace] RenderLoop: Consuming pendingDragStart`
5.  **Grab**: `[PointerTrace] RenderLoop: Grabbed node node-123`
6.  **Move**: `[PointerTrace] Sync: Moving drag...` (If this is missing, Sync is broken).
7.  **Up**: `[PointerTrace] Up id=1 captured=true`
8.  **Unlock**: `[PointerTrace] handleDragEnd: unlocked interaction`

## 5. Reconciling with Previous Report
*   **Previous Find (Forensic 1/31 A)**: "Deferred drag logic exists but is unwired."
    *   *Status*: **FIXED**. We wired `handleDragEnd` and `start` correctly.
*   **New Find (Forensic 1/31 B)**: "Wiring is correct, but coordinate sync might be failing or capture lost."
    *   *Refinement*: The previous report assumed wiring was sufficient. This report highlights that *even with wiring*, if the `hoverStateRef` doesn't update (due to pointer event drops), the drag is "alive" but "paralyzed".

## 6. Minimal Fix Direction
1.  **Guard Capture**: In `render()`, before consuming `pendingDragStart`, check `pendingPointerRef.current.hasPending` (or similar freshness flag).
2.  **Force Sync**: In `handleDragStart`, force an immediate `hoverStateRef` update to ensure the "frame 0" coordinates are perfect.
3.  **Safety Release**: Ensure `onLostPointerCapture` *always* calls `handleDragEnd`. (Verified: it does).

## 7. Risks Remaining
*   **Overlay Blocking**: If `e.target !== canvas` in `onPointerDown`, the click is ignored. This is the #1 suspect for "no interaction at all".
*   **Stuck Lock**: If an error throws inside the render loop *after* grab but *before* sync, the lock persists.
