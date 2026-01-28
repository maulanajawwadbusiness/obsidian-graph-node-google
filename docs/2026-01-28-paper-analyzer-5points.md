# Paper Analyzer Implementation Plan (5-Point Extraction)

**Date**: 2026-01-28
**Status**: In Progress

## Phase 0: Scan & Architecture Decisions

### 1. Popup Location
*   **File**: `src/popup/NodePopup.tsx`
*   **Finding**: Currently renders hardcoded "Lorem ipsum" paragraph. It blindly generates a title from `selectedNodeId` slice. It does not look up real node data from the engine.
*   **Action**: Must update `NodePopup` to look up the node from `engine` (via `PopupStore` or direct ref) and display `node.meta.summary`.

### 2. Data Storage (Option A Selected)
*   **Target**: `src/physics/types.ts` -> `PhysicsNode` interface.
*   **Change**: Add optional meta field:
    ```typescript
    meta?: {
        docId: string;
        sourceTitle: string;
        sourceSummary: string; // The "paragraph"
    }
    ```
*   **Why**: Cleanest coupling. Simulating a DB with a separate Map (Option B) adds sync complexity. `PhysicsNode` is the source of truth for the screen.

### 3. Loading Overlay
*   **Existing**: `loading_icon.png` exists in assets.
*   **State**: `DocumentStore` has `aiActivity`. We can reuse this field or alias it to `isAnalyzing`.
*   **Implementation**: Create `src/components/AnalysisOverlay.tsx` that observes `useDocument().state.aiActivity`.

### 4. Analyzer Module
*   **New File**: `src/ai/paperAnalyzer.ts`
*   **Function**: `analyzeDocument(text: string): Promise<AnalysisResult>`
*   **Output**:
    ```typescript
    type AnalysisResult = {
        points: Array<{
            title: string;   // For Node Label
            summary: string; // For Node Popup
        }>
    }
    ```

## Phase 1: Implementation Strategy
1.  **Create Analyzer**: Build `src/ai/paperAnalyzer.ts` using `OpenAIClient`. Prompt it to return JSON or strictly formatted text with 5 points.
2.  **Update Types**: Add `meta` to `PhysicsNode` in `types.ts`.
3.  **Wire Binding**: Update `nodeBinding.ts` to replace `applyAILabelsToNodes` (the "rewrite" logic) with `applyAnalysisToNodes`.
4.  **UI Updates**:
    *   `NodePopup.tsx`: Render `meta.sourceSummary`.
    *   `GraphPhysicsPlayground.tsx`: Add `<AnalysisOverlay />`.

## Next Steps
Proceeding to Phase 1 (Analyzer Implementation).
