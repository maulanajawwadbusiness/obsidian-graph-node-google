# Forensic Report: Cross-Browser Determinism & Accumulation
**Date:** 2026-02-01
**Task:** Ensure bit-exact reproduction of physics across browsers and prevent long-term floating point drift.

## 1. Forensic Analysis & Anchors

### A. Iteration Order Risks
1.  **Repulsion Neighbors (`forces.ts` L51-97)**
    -   Uses `neighborCache` which is a `Map<string, Set<string>>`.
    -   Logic iterates `activeNodes` (Array) and checks membership in `Set`.
    -   **Finding:** This IS stable because the outer loop order depends on `activeNodes` array, which is stable (sorted by wake/sleep logic). The `Set` is only used for lookups.
    -   **Correction:** My initial fear was unfounded for the main loop, but justified for any "for (key of set)" logic.

2.  **Constraint Hot Pairs (`constraints.ts` L357)**
    -   `for (const key of hotPairs)`. `hotPairs` is a `Set<string>`.
    -   **Confirmed Risk:** `Set` iteration order IS insertion-dependent.
    -   **Fix Implemented:** `Array.from(hotPairs).sort()` before iterating. This ensures deterministic accumulation order.

### B. Accumulation Drift
-   Added **Numeric Rebase** in `engineTick.ts`.
-   **Local Rebase:** Snaps `v` and `pos-prevPos` to 0.0 if `< 1e-5` when system is calm. Prevents "ghost energy" accumulation.
-   **Global Rebase:** Shifts world origin if `maxAbsPos > 50,000`. Keeps float precision high.

## 2. Implementation Summary

### HUD Diagnostics
-   **Checksum:** `determinismChecksum` displays a hex hash of quantized node positions. Allows instant verification of sync across browsers.
-   **Rebase Count:** Tracks how often the world origin has been shifted.

### Verification
-   **Checksum Stability:** In a calm state, the checksum remains constant.
-   **Cross-Browser:** Deterministic sorting ensures `hotPairs` are processed in the same order on V8 (Chrome) vs SpiderMonkey (Firefox), assuming standard array sort stability (which is spec-mandated now).

## Deliverables
-   `physicsHud.ts`: Added determinism fields.
-   `constraints.ts`: Sorted `hotPairs`.
-   `engineTick.ts`: Added checksum and rebase logic.
