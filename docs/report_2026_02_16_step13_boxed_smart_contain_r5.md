# Step 13 Run 5 - No Re-fit After User Interaction
Date: 2026-02-16
Scope: Boxed smart-contain guard only. No app mode behavior changes.

## Intent
Prevent one-shot boxed smart contain from re-applying after real user interaction, while keeping Step 12 resize semantics active.

## Changes

### 1) Added boxed user-interaction latch
- File: `src/playground/GraphPhysicsPlaygroundShell.tsx`
- Added refs:
  - `hasUserInteractedRef`
  - `skippedSmartContainForInteractionRef`
- Added stable callback:
  - `handleUserCameraInteraction` (boxed-only) marks `hasUserInteractedRef.current = true`.

### 2) Wired wheel camera interaction to the latch
- File: `src/playground/useGraphRendering.ts`
  - New optional prop: `onUserCameraInteraction?: (reason: 'wheel') => void`
  - Forwarded to render loop deps.
- File: `src/playground/rendering/graphRenderingLoop.ts`
  - New optional dep: `onUserCameraInteraction`
  - In native wheel handler, after target pan/zoom update, invoke `onUserCameraInteraction?.('wheel')`.

### 3) Marked drag-start as interaction in boxed preview
- File: `src/playground/GraphPhysicsPlaygroundShell.tsx`
- In `onPointerDown`, when a draggable dot hit exists, mark `hasUserInteractedRef.current = true` before queuing drag start.

### 4) Smart-contain gating updated
- File: `src/playground/GraphPhysicsPlaygroundShell.tsx`
- In boxed smart-contain effect:
  - If interface id changes: reset `didSmartContainRef`, `hasUserInteractedRef`, `skippedSmartContainForInteractionRef`, and warn flags.
  - If `hasUserInteractedRef` is true, skip smart contain and increment `recordBoxedSmartContainSkippedUserInteracted()` once per interface id.

## Why this is safe
- No continuous fitting loop introduced.
- Existing Step 12 resize effect remains unchanged and still applies preserve-center-world semantics.
- App mode remains unaffected because all latching logic is boxed-gated.

## Verification
- Ran `npm run build` after changes.

## Run 5 outcome
- One-shot smart contain now stays one-shot with a strict user interaction lockout.
- Resizes continue to use Step 12 semantics without triggering a re-fit.
