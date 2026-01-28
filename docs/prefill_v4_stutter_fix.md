# Prefill V4 Stutter Fix

## Problem
The seed phrase streaming ("In context of...") was causing visible frame drops (stuttering).

## Diagnosis
Performance instrumentation revealed that for every character revealed (approx. every 16-30ms):
1.  **React Render Thrashing**: `setInputText` was called inside the `requestAnimationFrame` loop, forcing `FullChatbar` and its subtree to re-render.
2.  **Layout Thrashing**: An autosize calculation (`scrollHeight` read -> `height` write) was performed synchronously in the same frame.

## The Fix

### 1. Decoupled Streaming
We switched the streaming engine to **Uncontrolled Mode** for the `textarea`.
-   **During Stream**: The animation loop writes directly to `textareaRef.current.value`. No React state updates (`setInputText`) occur. This keeps the React render cycle completely idle (0 re-renders).
-   **On Completion**: We sync the final text to React state (`setInputText`) once the stream finishes or is interrupted.

### 2. Layout Optimization
-   **Seed Phase**: We **completely disable** autosize calculations. The seed phrase is known to be short and single-line.
-   **Refine Phase**: We allow autosize, as the content is dynamic and longer.

### 3. Safety (Dirty Guard)
-   The "Dirty Guard" (`isProgrammaticSetRef`) is maintained to distinguish between the streaming engine and user typing.
-   If the user types, the stream is cancelled, and the `onChange` handler captures the current DOM value (streamed text + user key) and syncs it to React state immediately, ensuring valid data for the "Send" button.

## Verification
-   **Counters**: `seedTicks` increment, but `maxTickMs` remains < 1ms (pure JS DOM update).
-   **Visual**: Text appearance is 60fps smooth.
-   **State**: Send button becomes enabled correctly after stream finishes.
