# Forensic Report: UI Unresponsiveness Incident
**Date:** 2026-01-30
**Status:** CONSTANT (Reproducible)
**Severity:** CRITICAL (UI Blocking)

## Executive Summary
Following recent changes to the node drag interaction system, the Graph Playground UI has become largely unresponsive. Users are unable to click buttons, toggle panels, or close overlays. This investigation identifies the root cause as an aggressive **Global Pointer Capture** mechanism implemented on the main graph container, which intercepts interactions intended for overlay buttons.

## 1. Incident Description
- **Symptom:** "UI is no longer clickable. I cant click or close anything."
- **Affected Area:** All UI elements overlaying the graph canvas (Sidebar Toggle, Theme Toggle, Debug Console, Text/Preview Buttons).
- **Working Area:** The Node Dragging mechanics likely still work, but at the cost of all other UI.

## 2. Root Cause Analysis
The issue stems from the `onPointerDown` handler in `src/playground/GraphPhysicsPlayground.tsx`.

### The Mechanism
1. **Container Wrapper:** The main graph area is wrapped in a `div` (Line 361) that listens for `onPointerDown`.
2. **Child Elements:** UI buttons (like `CanvasOverlays`, `TextPreviewButton`) are **children** of this container `div`.
3. **Event Bubbling:** When a user clicks a button (e.g., "Sidebar Toggle"), the `pointerdown` event initiates on the button and bubbles up to the container.
4. **Blind Capture:** The container's handler executes the following logic (Line 106):
   ```typescript
   const onPointerDown = (e: React.PointerEvent) => {
       const canvas = canvasRef.current;
       if (!canvas) return;
       
       // CRITICAL FLAW: Captures pointer for ALL events bubbling to this container
       canvas.setPointerCapture(e.pointerId); 
       // ...
   }
   ```
5. **Event Retargeting:** Once `setPointerCapture` is called, the browser retargets all subsequent events for that pointer (including `pointerup` and the synthesized `click`) to the **Canvas Element**, ignoring the button that was originally pressed.
6. **Result:** The button never receives the `click` or `pointerup` event required to trigger its action.

### Why this happened
The intention was likely to ensure that dragging a node (which starts with a down event) continues even if the mouse moves outside the window or canvas bounds ("Pointer Capture"). However, applying this indiscriminately to *all* bubbling events compromised the `z-index` layering logic of the UI.

## 3. Affected Components
All components nested within the `MAIN_STYLE` div are affected:
- `CanvasOverlays`
    - Sidebar Toggle Button
    - Theme Toggle Button
    - Debug Overlay Toggle
- `TextPreviewButton`
- `PopupPortal` (Interactions inside popups might also be hijacked if they propagate)
- `AIActivityGlyph` (if interactive)

*Note: The Sidebar itself is a sibling and might work if it could be opened, but the toggle to open it is broken.*

## 4. Remediation Plan
To fix this without breaking the drag-outside-window feature, we must ensure capture only occurs when the user intends to interact with the *graph* (canvas), not the UI overlays.

### Recommended Fix: Target Filtering
Modify `onPointerDown` in `GraphPhysicsPlayground.tsx` to check the event target.

```typescript
const onPointerDown = (e: React.PointerEvent) => {
    // 1. Safety Check: Don't capture if interacting with UI buttons
    // The target should be the canvas itself or the container background, NOT a button.
    const target = e.target as HTMLElement;
    const isCanvasInteraction = target === canvasRef.current || target === e.currentTarget;

    // Optional: Also check for typical button types if structure is complex
    // if (target.tagName === 'BUTTON' || target.closest('button')) return;

    if (!isCanvasInteraction) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    // ... continue with node hit testing
};
```

Alternatively, we can stop propagation on all UI buttons, but that is fragile and requires changes in multiple files. The **Target Filtering** approach at the source of the capture is more robust.
