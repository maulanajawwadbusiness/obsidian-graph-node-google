# Forensic Report: Missing Hover Debug Logs

## Symptom
User enabled `hoverDebugEnabled: true` in `theme.ts`.
User reports `[HoverDbg]` logs are **absent** on hover.
Hover highlighting is "dead".

## Logic Chain Analysis
The `[HoverDbg]` logging was injected at the very top of `updateHoverSelection` in `hoverController.ts`.
If these logs are missing, **`updateHoverSelection` is NOT being called**.

### Trace Back
1.  **Caller**: `graphRenderingLoop.ts` calls `updateHoverSelectionIfNeeded`.
2.  **Condition**: `updateHoverSelectionIfNeeded` calls the callback ONLY if `shouldRun` is true.
    ```typescript
    const shouldRun = pendingPointer || (envChanged && hoverStateRef.current.hasPointer);
    ```
3.  **Input**: `pendingPointer` comes from `pendingPointerRef.current.hasPending`.
4.  **Source**: `handlePointerMove` in `hoverController.ts` sets `hasPending = true`.
5.  **Event**: `GraphPhysicsPlayground.tsx` calls `handlePointerMove` inside `onPointerMove`.
6.  **DOM**: `<div onPointerMove={onPointerMove}>` wraps the canvas.

## Failure Scenarios

### 1. Event blockage (Most Likely)
If `onPointerMove` on the container `div` is strictly **not firing**, then `handlePointerMove` never runs, `hasPending` stays false, and the loop never updates hover.
*   **Suspect**: `CanvasOverlays` or other children might be blocking pointer events (z-index, stopPropagation).

### 2. Reference Desync
If `useGraphRendering.ts` passes different `pendingPointerRef` objects to `createHoverController` vs `startGraphRenderLoop`, they won't share state.
*   **Check**: Code shows single `useRef` passed to both. Unlikely.

### 3. Loop Logic
If `graphRenderingLoop` thinks `pendingPointer` is false.
*   It reads `pendingPointerRef.current.hasPending` every frame.
*   This relies on `handlePointerMove` setting it to true.

## Conclusion
The break is strictly upstream of `updateHoverSelection`.
The likely culprit is **pointer events not reaching `onPointerMove`** or **`handlePointerMove` failing silentl**.

## Recommended Verification
1.  **Lightweight Event Log**: Add `console.log('DOM Move')` directly in `GraphPhysicsPlayground.tsx` -> `onPointerMove` to verify React is receiving events.
2.  **Overlay Check**: Inspect `CanvasOverlays` styles.
