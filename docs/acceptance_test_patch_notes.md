# Patch Notes: Acceptance Test Tooling
**Date:** 2026-02-01

## 1. Feature: Acceptance Tests UI
Added a dedicated "Acceptance Tests" checklist to the `CanvasOverlays` HUD.
*   **Location**: Debug Panel -> Right Column (below Harness).
*   **Content**: T1–T7 checklist matching the verification guide.
*   **State**: Local only (resets on reload).

## 2. Infrastructure: Forensic Reset
Verified `engineLifecycle.ts` correctly calls `engine.resetStartupStats()`.
*   **Impact**: When you click "Reset" or "N=XX" (spawn), the forensic counters for "First 2s" (Overlap, NaN, Speed) are reset to zero.
*   **Benefit**: Allows truthful re-testing of startup hygiene without reloading the page.

## 3. HUD Updates
verified `PhysicsHudSnapshot` contains required metrics for the tests:
*   `overlaps` (T3)
*   `strictClampActive` (T6)
*   `settleState` (T5)
*   `spring/repel` corrections (T1, T3)

## 4. Verification
*   **Manual**: Loaded the playground, clicked "N=20", dragged nodes. Checklist appears. Forensic stats reset on spawn.
