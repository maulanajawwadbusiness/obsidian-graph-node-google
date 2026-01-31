# Forensic Report: Diffusion Gate & Neighbor Jitter Hardening
**Date:** 2026-02-01
**Task:** Ensure continuous diffusion strength and stable neighbor sets to prevent motor effects.

## 1. Forensic Analysis & Anchors

### A. Diffusion Gating (Discontinuities)
**Problem:** Binary threshold `enableDiffusion` caused on/off popping when correction magnitude fluctuated around 0.2.
**Fix:** Implemented **Continuous Gating**.
-   `magWeight = smoothstep(0.1, 0.3, totalMag)` replaces the hard `> 0.01` check.
-   Diffusion strength scales linearly with this weight, ensuring 0.0 strength at 0.1 magnitude and full strength at 0.3.

### B. Neighbor Jitter (Temporal Instability)
**Problem:** `maxDiffusionNeighbors` selected arbitrary neighbors based on array order, which could fluctuate (jitter) if distances were similar or graph order changed.
**Fix:** **Deterministic Neighbor Sorting**.
-   Before truncating to `k` neighbors, the candidate list is sorted by:
    1.  Distance Squared (Ascending)
    2.  Node ID (Ascending) - Tie Breaker
-   This ensures that for any static set of positions, the selected neighbor subset is **identical** every frame.

## 2. Implementation Summary

### HUD Diagnostics
-   `diffusionPopScore`: Measures frame-to-frame change in `diffusionStrength`. Low is good.
-   `neighborDeltaRate`: Measures % of nodes changing their diffusion neighbor set per frame. Should be 0.0 at rest.

### Metrics Logic
-   **Neighbor Checksum**: `XOR` sum of active neighbor IDs (char codes + length).
-   **Pop Score**: `|currentGate - prevGate|`.

### Verification
-   **Pop Test**: Moving a node slowly near the 0.2 threshold results in smooth diffusion strength changes (no spikes).
-   **Jitter Test**: At rest, `neighborDeltaRate` is exactly 0.
