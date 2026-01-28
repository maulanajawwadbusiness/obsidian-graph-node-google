# Arnvoid Brand Label

**Date**: 2026-01-28
**Goal**: Add a subtle "Arnvoid" brand mark to the top-left of the application.

## Implementation

### 1. Component (`BrandLabel`)
*   **Location**: `src/playground/components/BrandLabel.tsx`
*   **Position**: Absolute at `top: 24px`, `left: 28px`.
*   **Style**:
    *   **Color**: `rgba(94, 114, 145, 0.4)` (Slate Blue Low Opacity) - Matches the "void" navy aesthetic but very subtle.
    *   **Font**: System UI, slightly weighted (`600`), 20px.
    *   **Interaction**: `pointer-events: none` to ensure it never blocks canvas interaction.

### 2. Integration
*   Rendered in `GraphPhysicsPlayground.tsx` alongside other canvas overlays (`MapTitleBlock`, `AnalysisOverlay`).
*   Z-index ensures it sits above the canvas but typically below modal overlays.

## Verification
*   Label appears in top-left.
*   Does not block clicking nodes in that corner.
*   "Arnvoid" text is visible but non-distracting.
