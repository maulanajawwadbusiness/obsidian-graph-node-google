# Fix Report: Focus, Gestures, & Interaction Layer
**Date**: 2026-01-30
**Status**: APPLIED
**Scope**: "User Eyes" Initiative (Fixes #40, #41, #42)

## 1. Problem Statement
The application suffered from three interaction "leaks" that broke the sense of solidity:
1.  **Focus Ambiguity**: Browser default shortcuts (Space/Arrows) triggered page scrolling or canvas actions even when the user intended to interact with the UI, or vice versa.
2.  **Gesture Conflict**: Touch/Trackpad gestures (Pinch/Swipe) triggered native Browser Zoom/Navigation instead of App Zoom/Pan.
3.  **Invisible Blockers**: Usage of full-screen overlays creates potential "dead zones" where clicks are swallowed.

## 2. Solutions Applied

### A. Global Focus Gate (Fix #40)
**Mechanism**: A `useEffect` hook in `GraphPhysicsPlayground` now acts as the central keyboard authority.
**Logic**:
*   **Input Detection**: If `document.activeElement` is an `<input>`, `<textarea>`, or `contentEditable`, the gate opens (returns). Browser/Input default behavior is preserved (typing text).
*   **Canvas Guard**: If focus is on the Body or Canvas, the gate **Blocks** (`preventDefault`) specific navigation keys:
    *   `Space`
    *   `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
**Effect**: Pressing Spacebar on the canvas no longer scrolls the page down. It is now reserved for app-level shortcuts (e.g. Center View or Play/Pause).

### B. Gesture Locking (Fix #41)
**Mechanism**: CSS `touch-action` property.
**Change**: Added `touchAction: 'none'` to the `MAIN_STYLE` (Canvas Wrapper) in `graphPlaygroundStyles.ts`.
**Effect**: This explicitly tells the browser "Do not handle touch gestures here."
*   **Pinch**: No longer zooms the browser page. Available for App Zoom.
*   **Swipe**: No longer triggers browser Back/Forward navigation.

### C. Layer Audit (Fix #42)
**Mechanism**: Inspections of `z-index` and `pointer-events`.
**Findings**:
1.  **`PopupOverlayContainer`**: Confirmed `pointer-events: none` on the root 100% wrapper. This ensures it does not block the canvas when popups are present but sparse.
2.  **`AnalysisOverlay`**: Confirmed it physically unmounts (`return null`) when not active. When active, it correctly blocks interaction (`pointer-events: all`) to prevent state corruption during analysis.
3.  **Sidebar/Panels**: Confirmed they sit in the Flex layout (not absolute overlays), so they physically displace the canvas rather than covering it invisibly.

## 3. Code Cleanups
*   **Dead Code**: Removed undefined refs (`isDraggingRef`, `pendingDragRef`) from `GraphPhysicsPlayground.tsx` that were causing lint errors. The `blur` handler now relies correctly on the Engine's `draggedNodeId` state.

## 4. Verification Steps
1.  **Focus**: Click chat -> Type Space -> Text appears, no scroll. Click Canvas -> Press Space -> No scroll.
2.  **Touch**: Pinch trackpad on canvas -> Graph zooms, Page stays 100%.
3.  **Clicks**: Click empty space near a popup -> Physics Canvas selects/drags (click passes through overlay container).
