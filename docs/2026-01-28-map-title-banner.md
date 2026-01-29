# Map Title Banner

**Date**: 2026-01-28
**Goal**: Display a "Antarmuka Pengetahuan 2 Dimensi" banner with the AI-inferred document title at the bottom-center of the map.

## Architecture

### 1. State Source (`DocumentStore`)
*   Added `inferredTitle` (string | null) to `DocumentState`.
*   Added `SET_INFERRED_TITLE` action.
*   **Logic**: This field is populated by the `applyAnalysisToNodes` function in `nodeBinding.ts` immediately after the AI Analyzer returns the "Main Topic".

### 2. UI Component (`MapTitleBlock`)
*   **Location**: `src/playground/components/MapTitleBlock.tsx`
*   **Position**: Absolute positioning at `bottom: 32px`, centered.
*   **Style**: Void aesthetic (dark mode compatible), non-intrusive.
*   **Interaction**: `pointer-events: none` ensures clicks pass through to the canvas/nodes below.
*   **Fallback Logic**:
    *   If `inferredTitle` exists → Show it.
    *   Else if `activeDocument` exists → Show filename (cleaned).
    *   Else → Show "Judul paper di sini".

### 3. Wiring
*   `GraphPhysicsPlayground` renders `<MapTitleBlock />` as a sibling to overlays.
*   It passes `documentContext.setInferredTitle` into the binding layer.

## Verification
1.  **Empty State**: Shows "Judul paper di sini".
2.  **Upload**: After analysis, updates to "Main Topic Title".
3.  **Interaction**: Does not block canvas panning/zooming.
