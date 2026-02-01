# Patch Notes: Acceptance Spec Knife-Grade Upgrade
**Date:** 2026-02-01

## 1. Specification Sharpening
Upgraded `docs/acceptance_good_springmass_in_hand.md` to "Knife-Grade" status.
*   **Calibration Table:** Added explicit units and range gates for `springCorrMax` (px/tick), `repulsionMaxMag` (Force), and `jitterAvg` (px/sec).
*   **Profiles:** Split tests into **CORE [A]** (Pure physics: No diffusion/microslip) and **PROD [B]** (With helpers).
*   **Collision Firmness:** Defined "Limit Push" protocol (spikeOverlap -> release) with a precise recovery band of **1.0–1.5s**.
*   **Cross-Count:** Added **"Law Continuity"** check for recoil flips across N=5/60/250 to prevent logic divergence at scale.

## 2. HUD Synchronization
Updated `CanvasOverlays.tsx` checklist labels with **Profile Tags** and sharper thresholds.
*   Ex: `T3 [B] Collide (Overlaps=0 in 1-1.5s)`
*   Ex: `T7 [B] Scale (Law Invariant N=5/60/250)`

## 3. Impact
Verification is now strictly quantified. "Feels good" is replaced by "Correction > 2.0px and Jitter < 0.005".
