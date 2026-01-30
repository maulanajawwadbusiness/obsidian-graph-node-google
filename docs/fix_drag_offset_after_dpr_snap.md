# Fix: Drag Offset Regression (Knife-Sharp Input)

**Date**: 2026-01-30
**Agent**: Antigravity
**Regression**: "Node lags/offsets from the cursor" during high-speed drag after DPR/Snapping update.

## Root Cause Analysis

### 1. The 1-Frame Latency Gap
The render loop in `useGraphRendering.ts` followed this sequence:
1.  **Physics Tick**: Runs `applyDragVelocity`, setting `node.x` to `dragTarget` (Value from *Start* of Frame).
2.  **Fix 55 Block**: Input logic updates `dragTarget` to the *Latest* Mouse Position (using fresh Snapshot).
3.  **Draw**: `drawNodes` renders `node.x`.

**Result**: `drawNodes` was rendering the *Old* `dragTarget` value (via `node.x`), while `dragTarget` itself was fresh. This created a consistent trail behind the cursor, proportional to drag speed (1 frame lag).

### 2. Input Quantization (Secondary)
`hoverController`'s `clientToWorld` function was instantiating `CameraTransform` using the static `settings.pixelSnapping` configuration (True). While `clientToWorld` implementation currently ignores this flag, passing it created a risk of future "Input Snapping" where the drag target would step-ladder instead of sliding smoothly.

## Implemented Fixes

### 1. Zero-Latency Draw Sync (`useGraphRendering.ts`)
In the "Fix 55" block (Render Loop), immediately after calling `engine.moveDrag({ freshX, freshY })`, we now **manually override** the node's position:
```typescript
draggedNode.x = freshX;
draggedNode.y = freshY;
```
This ensures `drawNodes` (which runs immediately after) sees the absolutely latest position, eliminating the visual lag.

### 2. Input Snapping Override (`hoverController.ts`)
Updated `clientToWorld` to accept a `snapOverride` argument.
Updates calls in `GraphPhysicsPlayground.tsx` (PointerDown/Move) and `useGraphRendering.ts` to pass `snapOverride: false`. This enforces "Knife-Sharp" float precision for all interaction targets, regardless of visual snapping settings.

## Verification Steps
1.  **High-Speed Drag**: Whip the mouse. The node should stay strictly under the cursor (crosshair center) with no visible trail.
2.  **Micro Drag**: Slow movement produces smooth float updates (no pixel stepping).
3.  **Visuals**: Rendering still respects "Visual Dignity" (Degrade modes, Snapping at Rest), but *Interaction* is now authoritative and instant.
