# Physics Hardening: Top 10 Risks Fixed
**Date:** 2026-02-01
**Focus:** Continuous Law, Determinism, and Perf Scale.

## 1. Determinism & Checksum
**Risk:** `Math.random()` usage in overlap resolution caused divergence across runs/browsers.
**Fix:**
-   Implemented `engine.pseudoRandom(seedA, seedB)` using FNV-1a hash.
-   Replaced all `Math.random()` in `forces.ts` (Collision/Spring/Repulsion fallbacks) and `constraints.ts` (Constraint fallback) with this deterministic source seeded by Node/Link IDs.
-   **Result:** Exact overlaps now resolve in identical directions every time.

## 2. HUD Truth (Diffusion)
**Risk:** Stale `diffusionStrengthNow` stats persisted when diffusion was gated off, confusing debug analysis.
**Fix:**
-   `corrections.ts`: Explicitly zeros `stats.diffusionStrengthNow` if `policy.diffusion` or `diffusionSettleGate` is effectively zero.
-   **Result:** HUD diffusion bar instantly drops to empty when the motor stops.

## 3. Rebase Camera Sync
**Risk:** "Global Rebase" shifted nodes but left the camera behind, causing a visual jump.
**Fix:**
-   Added `onWorldShift(dx, dy)` callback to `PhysicsEngine`.
-   Triggers in `engineTick.ts` when rebase threshold (>50k) is met.
-   **Result:** Renderer can now transparently shift the view to match the physics shift.

## 4. Performance & Scale (The "Law Pop" Killers)
**Risk:** O(N^3) loops and repeated O(N^2) density scans caused frame drops at higher node counts, breaking "1:1 Time" contract.
**Fix:**
-   **Triangle Cache**: Pre-computed triangle list in `engineTopology.ts` (O(N^3) only on topology change). `constraints.ts` now uses O(1) cache.
-   **Density Cache**: Computed `localDensity` once per tick in `engineTick.ts` (O(N^2)) and shared across all injectors.
-   **Hot Pair Hygiene**: Pruned dead keys from `hotPairs` in `constraints.ts` to prevent memory leaks.
-   **Wall-Clock Cooldown**: Replaced `lifecycle`-based cooling with `getNowMs()` to prevent heartbeat changes during pauses.

## Verification
-   **Determinism**: Refresh graph 5 times. Nodes should resolve from (0,0) in exact same starburst pattern.
-   **Perf**: Graph with 100 nodes should not stutter during topology changes or steady state.
-   **HUD**: "Diffusion" value should never stick at 0.05 when system is calm.
