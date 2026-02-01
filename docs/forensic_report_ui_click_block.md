# Forensic Report: UI Click Detection Failure
**Date:** 2026-02-01
**Target:** `src/playground/components/CanvasOverlays.tsx` triggers vs `src/playground/GraphPhysicsPlayground.tsx` container policy.

## 1. Executive Summary
**Verdict**: **Confirmed Logic Flaw (Event Bubbling / Pointer Capture conflict)**.
**Severity**: **High** (UI works visually but fails interactively).
**Status**: Root cause identified. Fix ready for implementation.

The issue is caused by the **Pointer Capture Hardening** introduced in the "Fixing Drag Feel Issues" sprint. The parent container (`GraphPhysicsPlayground`) aggressively captures all `pointerdown` events to ensure reliable drag tracking.

However, the UI buttons (Debug Toggle, Theme Toggle, Controls Toggle) in `CanvasOverlays` only stop **Mouse** event propagation (`onMouseDown`), not **Pointer** event propagation (`onPointerDown`). As a result, the `pointerdown` event bubbles to the parent, which captures the pointer. This "steals" the subsequent `pointerup` and `click` events from the button, effectively rendering it unclickable despite visual hover states working perfectly.

## 2. Forensic Analysis

### A. Symptom
-   **Hover Works**: CSS `:hover` states function correctly because no pointer capture is active during movement.
-   **Click Fails**: Clicking a button produces no action.
-   **Scope**: Affects "floating" buttons in `CanvasOverlays`. Likely affects buttons *inside* the debug panel if they don't explicitly stop pointer propagation (though the panel container itself might shield them).

### B. The Mechanism of Failure
1.  **User Clicks Button**: Browser fires `pointerdown`.
2.  **Bubbling**: The button has no `onPointerDown` handler, so the event bubbles up to `GraphPhysicsPlayground`.
3.  **Capture Trap** (`GraphPhysicsPlayground.tsx:190`):
    ```typescript
    container.setPointerCapture(e.pointerId);
    ```
    The parent container claims exclusive rights to this pointer ID.
4.  **The Heist**:
    -   User releases mouse button.
    -   Browser fires `pointerup`.
    -   Due to capture, `pointerup` is targeted at the **Container**, not the **Button**.
    -   The Button never receives `pointerup` or the synthesized `click` event.

### C. Code Evidence

#### 1. The Trap (GraphPhysicsPlayground.tsx)
The container captures the pointer whenever it receives a `pointerdown` event.
```typescript
// GraphPhysicsPlayground.tsx:175
const onPointerDown = (e: React.PointerEvent) => {
    const container = e.currentTarget as HTMLElement;
    // ...
    container.setPointerCapture(e.pointerId); // <--- CAPTURES HERE
    // ...
};
```

#### 2. The Leaky Component (CanvasOverlays.tsx)
The buttons stop `mousedown` (legacy) but allow `pointerdown` (modern) to leak.
```typescript
// CanvasOverlays.tsx:136 (Debug Toggle Button)
<button
    // ...
    // Stops Mouse events (Legacy)
    onMouseDown={stopPropagation}
    onMouseMove={stopPropagation}
    onMouseUp={stopPropagation}
    // MISSING: onPointerDown={stopPropagation}  <--- LEAK!
    onClick={(e) => { ... }}
>
```

In contrast, the **Debug Overlay Panel** (lines 190-207) *does* correctly stop pointer events, which is why interactions *inside* the panel might still work (unless specific inner elements are also leaking):
```typescript
// CanvasOverlays.tsx:204
onPointerDown={stopPropagation} // <--- Correctly shields the panel
```

## 3. Recommended Fix
We must make the UI buttons "Pointer Blocking" to prevent the parent from initiating a drag capture.

**Action**: Add `onPointerDown={stopPropagation}` to all interactive overlays in `CanvasOverlays.tsx`:
1.  Debug Toggle Button.
2.  Theme Toggle Button.
3.  Sidebar Toggle Button.

```typescript
// Proposed Fix Pattern
<button
    onMouseDown={stopPropagation}
    onPointerDown={stopPropagation} // <--- ADD THIS
    // ...
>
```

This ensures the `pointerdown` event dies at the button level. The parent never sees it, never captures the pointer, and the button successfully receives the full click sequence.
