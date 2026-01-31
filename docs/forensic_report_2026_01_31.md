# Forensic Report: Hover Input Failure & Resolution
**Date**: 2026-01-31
**Target**: `GraphPhysicsPlayground` & `hoverController.ts`
**Severity**: Critical (Total Loss of Interaction)

## 1. Executive Summary
The "Dead Hover" issue (pointer moving but no node highlighting/interaction) was investigated through a rigorous forensic auditing process. The investigation revealed a complex interplay of **logic bugs in the forensic probes themselves** and a **potential architecture race condition**.
The final resolution confirmed that the core architecture (Single Loop, Stable Refs) is sound, and the issue was resolved by patching the `updateHoverSelectionIfNeeded` logic to correctly handle environmental changes (Env Change Logic) and fixing the forensic instrumentation that was hiding the true state.

## 2. The Anomaly
**Symptoms**:
*   Pointer events active (cursor moves).
*   Nodes do not highlight.
*   Clicking nodes does nothing.
*   Logs show "Input Active" but "Loop Gate" appeared silent.

**Initial Hypothesis**:
1.  **Blockage**: Simulation loop crashing before hit-test?
2.  **Split Brain**: Input handlers writing to Ref Set A, while Render Loop reads Ref Set B?
3.  **Gate Failure**: `pendingPointer` flag being cleared or ignored?

## 3. The Investigation Path

### Phase 1-4: Probing the Void
We instrumented `hoverController.ts` and `graphRenderingLoop.ts` with `[HoverDbg]` logs.
*   **Result**: Input logs fired. Loop logs did not.
*   **False Lead**: This suggested the loop was dead or blocked.

### Phase 5: Crash Trap
We wrapped `renderScratch.prepare` in a try-catch block.
*   **Result**: No crash. The loop was running and preparing the grid successfully.
*   **Inference**: The failure lay in the *logic gate* controlling the execution of `updateHoverSelection`.

### Phase 6: The Split Brain Theory
Logs finally appeared showing:
*   Input Handler: `pending=true`
*   Loop Gate: `pending=false`
*   **Theory**: Architecture Wiring Fault. If the component re-mounted (creating new Refs), but the old Loop did not stop (Zombie Loop), or the new Loop started with old Refs (Stale Closure), we would have a mismatch.

### Phase 7: Architecture Hardening
We applied definitive markings to proving the theory:
1.  **LOOP_ID**: Unique ID for each `startGraphRenderLoop` instance.
2.  **Ref ID**: Stamped `__debugId` onto the `hoverStateRef` object.
3.  **Logs**: Start/Stop loop lifecycle tracking.

### Phase 8: The Probe Failure (The Reveal)
The logs returned a surprising result:
*   **Lifecycle**: Clean. `Start Loop A` -> `Stop Loop A` -> `Start Loop B`. **No Zombie Loops.**
*   **Ref Stability**: Loop A and Loop B saw the **SAME** Ref ID (`hvr-384`). **No Split Brain.**
*   **The Error**: Input logs showed `refId=undefined`, and Gate logs occurred rarely or contained `NaN`.

**Root Cause of Investigation Failure**:
1.  **Gate Log Bug**: `now - lastGateLog > 1000`. On the first frame, `lastGateLog` is `undefined`. `NaN > 1000` is false. The probe suppressed itself.
2.  **Input Log Bug**: Accessed `.current.__debugId` on the Ref wrapper, instead of the stamped property.

## 4. The Resolution

### A. Probe Repair
We fixed the probes (`|| 0` for timestamps, correct property access). This revealed the data flow was actually working (Gate Log appeared).

### B. Logic Fix (The "Why")
The actual fix for the "Dead Hover" involved:
1.  **Unified Snapshot**: Updating `clientToWorld` to accept `FrameSnapshot` (camera/dpr/rect) ensuring the Input logic uses the exact same coordinate space as the Render logic.
2.  **Env Change Logic**: `updateHoverSelectionIfNeeded` was updated to explicitly check `globalSurfaceGeneration` and Camera epsilon changes, ensuring a re-hit test even if the mouse didn't move (e.g., zoom/pan).
3.  **Ref Wiring**: Ensuring `hoverStateRef` passed to `createHoverController` is the exact same reference used by the loop.

## 5. Final Architecture Verification
The system now adheres to the **Hardened Interaction Contract**:
1.  **Single Loop Authority**: Only one `requestAnimationFrame` loop runs. It strictly respects `useEffect` cleanup.
2.  **Stable References**: `useGraphRendering` creates Refs **once**. These stable refs are passed to both the Event Handlers and the Render Loop. Restarting the loop (HMR/Config change) reuses the existing Refs.
3.  **Interaction Locking**: Dragging locks the node (`isFixed=true`) and strictly syncs position via `applyDragTargetSync`.

## 6. Cleanup
All `[HoverDbg]` instrumentation was removed to restore code cleanliness. The fix is active in `master`.
