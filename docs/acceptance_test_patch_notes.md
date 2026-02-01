# Patch Notes: Acceptance Spec Sharpening
**Date:** 2026-02-01

## 1. Specification Upgrade
Converted `docs/acceptance_good_springmass_in_hand.md` from a loose guide to a **Spec**.
*   **Defined Gates:** Added numeric thresholds for every test (e.g., `Jitter < 0.005`, `Gap < 50px`, `Settle < 3s`).
*   **Hand Actions:** Detailed the exact gestures ("Whip", "Stretch 200px", "Drag into Cluster").
*   **Cross-Count Table:** Explicit expectations for N=5, 60, and 250.

## 2. HUD Synchronization
Updated `CanvasOverlays.tsx` checklist labels to **mirror the spec**.
*   **Benefit:** The HUD now tells you the pass criteria (e.g., "Collide (Overlaps=0 in <1s)") so you don't need to alt-tab to the docs during testing.

## 3. Single Source of Truth
The HUD checklist and the Markdown Spec now agree on what "Good" looks like.
