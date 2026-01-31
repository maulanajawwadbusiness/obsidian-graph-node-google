# Forensic Report: Stiffness Ping-Pong & Rest Hysteresis

## 1. Stiffness Ping-Pong Analysis
-   **Current Model**: `stiffness = baseK * (dt * 60.0)`.
    -   `applyEdgeRelaxation`: `relaxStrength = 0.02 * timeScale`.
    -   `applySpacing`: `maxCorr` scaled linearly.
    -   `applyTriangleArea`: `areaStrength = 0.0005 * energy * timeScale`.
-   **Problem**: Linear scaling is unstable if `dt` spikes or if `k` is large.
    -   Ideal PBD/XPBD uses `alpha = 1 - exp(-k * dt)`.
    -   Current linear model `k * dt` can exceed 1.0 -> Overshoot -> Ping-Pong.
-   **Fix**: Replace `timeScale` linear multiplication with exponential decay lambda.
    -   Define `stiffnessPerSec`.
    -   `alpha = 1 - Math.exp(-stiffnessPerSec * dt)`.

## 2. Rest Detection Flapping
-   **Current Logic** (`engineTick.ts`):
    ```typescript
    if (avgVelSq > 0.25) state = 'moving';
    else if (avgVelSq > 0.04) state = 'cooling';
    // ...
    ```
-   **Problem**: Zero Hysteresis.
    -   If `avgVelSq` is `0.040001` -> `cooling`.
    -   If `avgVelSq` is `0.039999` -> `microkill`.
    -   Noise causes rapid flipping ("Buzzing"), triggering/killing micro-behaviors repeatedly.
-   **Fix**: Implement Hysteresis Band.
    -   `conf` (Confidence) 0..1 accumulator.
    -   Enter `sleep` only if `conf > 0.95`.
    -   Exit `sleep` only if `conf < 0.80`.
    -   Or state-based thresholds:
        -   If `cooling`, move to `microkill` if `v < 0.0004` (Enter).
        -   If `microkill`, move to `cooling` if `v > 0.001` (Exit).

## 3. Plan
1.  **Diagnostics**: Add `corrSignFlipRate` (oscillation) and `restFlapRate` (stability).
2.  **Stiffness Fix**: Update `constraints.ts` to use `1 - exp(-k * dt)` for all strength factors.
3.  **Hysteresis Fix**: Rewrite `settleState` logic in `engineTick.ts` to use `Schmidt Trigger` style thresholds.
