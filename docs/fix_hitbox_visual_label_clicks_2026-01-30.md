# Forensic Mapping Fix: Hitbox, Visuals, Labels
**Date**: 2026-01-30
**Status**: **HARDENED**
**Changes**: `GraphPhysicsPlayground.tsx`, `hoverController.ts`

## 1. Executive Summary
Phase 4 of the hardening successfully aligned the "User's Eye" with the "Engine's Hand". Use perception of glow and labels is now the absolute truth for interaction.
*   **Hitbox Mismatch**: **FIXED**. "What Glows Is Grabbable." Drag logic now uses the exact same `hitRadius` (visual + padding) as the hover effect.
*   **Offset**: **ELIMINATED**. By unifying the hit-test pipeline, the naive `radius+10` offset drift is gone.
*   **Label Interaction**: **ENABLED**. Clicking the text of a node now selects/drags it.

## 2. Forensic Findings

### A. Split-Brain Input (Fixed)
*   **Issue**: `onPointerDown` (Drag) used a naive `Math.sqrt(d) < radius + 10` loop.
*   **Result**: This ignored `pixelSnapping`, `scale`, and theme variants (e.g. Ring width). It tracked differently than the Visual Glow (handled by `hoverController`).
*   **Fix**: `GraphPhysicsPlayground` now calls `updateHoverSelection()` immediately on click, then trusts `hoverState.hoveredNodeId`. This forces 1:1 consistency between Visuals and Interaction.

### B. Label Blindness (Fixed)
*   **Issue**: `hoverController` ignored text labels entirely.
*   **Result**: Users trying to click long labels would miss.
*   **Fix**: Added `checkLabel` pass to `evaluateNode`.
    *   Computes Label AABB (Axis Aligned Bounding Box) based on `theme.labelFontSize` and `labelOffset`.
    *   If cursor is inside Label AABB, `dist` is forced to 0 (Perfect Hit).
    *   "If you can read it, you can click it."

## 3. Verification
*   **Visual Alignment**: Clicking the outer edge of a glowing node now grabs it (previously required clicking deeper).
*   **Text Grabbing**: Clicking the text label selects the node immediately.
*   **Code Quality**: Removed duplicate distance loops. Input handling is now centralized in `hoverController`.

## 4. Conclusion
This completes the "User Eyes" hardening. The physics playground now respects the visual contract absolutely.
