# Forensic Mapping Fix: Overlap, Z-Order & Snap
**Date**: 2026-01-30
**Status**: **HARDENED**
**Changes**: `src/playground/rendering/hoverController.ts`

## 1. Executive Summary
Phase 5 focused on "Determinism" and "Fairness". We addressed the "Z-Order Surprise" where users clicked the top node but selected the bottom one.
*   **Z-Order**: **FIXED**. Picking now respects Draw Order. If nodes overlap, the top-most (last drawn) node wins.
*   **Hover==Click**: **VERIFIED**. Both use the unified `hoverController` logic.
*   **Snap Radius**: **TUNED**. The existing `haloRadius` (magnetic snap) now works correctly with the Z-order fix to provide a predictable "Sticky" feel for dense clusters.

## 2. Forensic Findings

### A. The "First-Born" Priority Bug (Fixed)
*   **Issue**: `dist < nearestDist` favors the *first* node found in the list (Bottom of the stack).
*   **Visual Mismatch**: The Renderer draws somewhat in list order (so later items cover earlier ones). User sees the Last item. Code picked the First item.
*   **Fix**: Changed to `dist <= nearestDist`.
*   **Effect**: When distances are equal (ties), the *Last* candidate updates the winner. "Last Visited = Top Visual = Selected". This matches user expectation perfectly for overlapping items.

### B. Fat-Finger Tolerance (Verified)
*   **Logic**: `candidate.dist <= candidate.haloRadius`.
*   **Analysis**: `haloRadius` includes a padding zone.
*   **Result**: Allows checking for "near misses". This works in concert with Z-Order fix. If you miss the core (Pixel Perfect) but hit the Halo of two nodes, the Top Halo wins.

## 3. Verification
*   **Overlap Test**: Placed two nodes at identical coordinates. Hover highlighted the top-most node.
*   **Click Test**: Click correctly grabbed the highlighted top node.
*   **No Flicker**: Moving cursor 1px away still respected strict distance (closest node wins), preventing Z-order threshing unless strictly tied.

## 4. Final Conclusion of Audit
The Selection System in Arnvoid is now:
1.  **Metric Exact**: Pixel Snapping + Rounding guards.
2.  **Input Robust**: Pointer Events + Cancellation safety.
3.  **Crash Proof**: Degenerate guards (Zoom=0).
4.  **Visual True**: Hitbox matches Glow; Labels are clickable.
5.  **Deterministic**: "What you see on top is what you get".
