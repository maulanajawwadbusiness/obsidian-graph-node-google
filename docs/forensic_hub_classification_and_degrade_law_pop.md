# Forensic Report: Hub Classification & Degrade Law Pops

**Date:** 2026-02-01
**Subject:** Discontinuities in Physical Laws (Hubs & LOD)

## 1. Hub Classification Anchors (`degree >= 3`)

| Gate Condition | Location | Effect | Discontinuity Risk | Fix Plan |
| :--- | :--- | :--- | :--- | :--- |
| `smoothstep(2.0, 6.0, degree)` | `motionPolicy.ts:29` | Base scalar `hubK` 0..1 | **None** (Continuous) | Reuse this everywhere. |
| `hubScale <= 0.001` | `constraints.ts` (Spacing) | Skips constraint entirely | **Low** (Tiny Force -> 0) | Remove binary check or ensure smooth fade to 0. |
| `deg >= 3` | `forcePass.ts:81` (Pre-Roll) | Scales spring force 0.25..1.0 | **High** (Pop 1.0 -> 0.25) | Use `hubK` to blend stiffness continuously. |
| `deg >= 3` | `forcePass.ts:116` (Symmetry) | Enables Null-Force Bias | **Medium** (Bias activates) | Use `hubK` to scale bias magnitude. |
| `deg > 1` | `constraints.ts` (EdgeRelax) | Enables Edge Relaxation | **Medium** (Pop) | Allow deg=1 with low weight or smooth ramp? |

## 2. LOD/Degrade Anchors (`perfMode`)

| Gate Condition | Location | Effect | Discontinuity Risk | Fix Plan |
| :--- | :--- | :--- | :--- | :--- |
| `computePairStride` | `engineTick.ts:114` | Returns Integer Stride (1, 2, 3...) | **High** (Density/Stiffness Step) | Scale Force/Stiffness by `stride` in physics kernels. |
| `perfMode === 'normal'` | `engineTick.ts:728` | Enables Triangle Constraints | **Critical** (Faces disappear) | Always run, scale stiffness/prob by degradeScalar. |
| `perfMode === 'fatal'` | `forcePass.ts:738` | Skips Core Forces | **Critical** (Physics changes) | Ensure "Fatal" still applies minimal containment/damping (done), but maybe ramp down forces instead of hard cut? |

## 3. Discontinuity Analysis

### Stride Step Function
`pairStride` roughly doubles (1 -> 2) when budget pressure rises.
- **Repulsion:** `density` calculation in `forces.ts` SCALES count: `val * pairStride`. This compensates density magnitude.
- **Spacing Constraints:** `applySpacingConstraints` skips pairs. Stiffness effectively drops by `1/stride`.
    - **Fix:** In `constraints.ts`, multiply `correction` by `pairStride` (with cap) to maintain mean stiffness.

### Degrade Switching
`engine.degradeLevel` is smoothed (`lerp 0.05`), but `perfMode` thresholds are hard (0.2, 0.5, 0.8).
- **Triangle Constraints:** Logic checks `perfMode`.
    - **Fix:** Remove `perfMode` check. Use `motionPolicy.degradeScalar` to scale `triangleStrength`. If scalar > 0.8 (emergency), maybe strength -> 0.

## 4. Plan
1.  **Hubs:** Replace `deg >= 3` with `hubK` blending in `forcePass.ts` (PreRoll & Symmetry).
2.  **LOD:**
    -   Inject `pairStride` into `applySpacingConstraints` stiffness logic.
    -   Start Triangle Pass always, but scale `areaStrength` by `(1 - degradeScalar)`.
    -   Ensure `perfMode` is visual-only/logging, while physics uses continuous `degradeLevel`.
