# Forensic Hand-off Report: Singularity & Stability Fixes
**Date:** 2026-01-31
**Subject:** Repulsion Singularity, Overlap Resolution, and Code Hygiene

## 1. Executive Summary
This session focused on eliminating "Explosive Singularity" bugs where nodes occupying the exact same coordinates ($d \approx 0$) would generate NaN/Infinite forces or remain stuck. We also performed a massive cleanup of the physics kernel, removing 2x code duplication in `forces.ts` and fixing broken closure scopes in `constraints.ts`.

## 2. Key Architectural Changes

### A. Deterministic Singularity Handling (`forces.ts`)
**Problem:** When $dx=0, dy=0$, previous logic used `Math.random()`, which caused non-deterministic jitter and failed to resolve "stacked" nodes reliably during simulation replay or drag-release.
**Solution:**
- Implemented **ID-Seeded Deterministic Angle**:
  ```typescript
  if (Math.abs(dx) < epsilon) {
      const seed = (nodeA.id.charCodeAt(0) + nodeB.id.charCodeAt(0));
      const angle = (seed % 17) * (Math.PI / 8.5);
      dx = Math.cos(angle) * 0.1;
      dy = Math.sin(angle) * 0.1;
  }
  ```
- **Why:** Guarantees that two nodes with specific IDs *always* separate in the same direction, preserving simulation stability and preventing "buzzing".

### B. Gentle Overlap Resolver (`constraints.ts`)
**Problem:** The `applySpacingConstraints` function previously returned `false` for `d < 0.1`, effectively giving up on overlapping nodes. This left them trapped until repulsion (potentially explosive) separated them.
**Solution:**
- **Project, Don't Reject:** Now handles `d < 0.1` by using the same deterministic angle logic to define a separation vector.
- **Deep Boost:** Added a `deepBoost` factor ($2.0x$) for deep overlaps to ensure they separate prioritized over minor spacing adjustments.
```typescript
const deepBoost = d < D_hard * 0.1 ? 2.0 : 1.0;
corr = penetration * ramp * deepBoost;
```

### C. Safe Repulsion Core
**Problem:** Repulsion force was unbounded as $d \to 0$.
**Solution:**
- **Dynamic Softening:** Defined `softR = minNodeDistance * 0.25`.
- **Force Clamping:** Added `repulsionMaxForce` check to cap catastrophic kicks.
- **Safe Distance:** Force uses `Math.max(d, repulsionMinDistance)` where `minDistance` is ensured to be $\ge 0.1$.

## 3. Forensic Code Cleanup

### A. The "Triple-Definition" Incident (`forces.ts`)
**Discovery:** The `applyRepulsion` function contained **three separate, conflicting definitions** of the `applyPair` helper function, likely due to previous incomplete merges or copy-paste errors.
- **Fix:** Removed the first two vestigial definitions.
- **Result:** The active implementation is now the single source of truth, containing the latest singularity fixes.

### B. Broken Scopes (`constraints.ts`)
**Discovery:** Use of variables like `timeScale` and `applyPairLogic` inconsistent with their scope or usage.
- **Fix:** Removed unused `timeScale`. Renamed `timeScaleMultiplier` to `_timeScaleMultiplier` (deprecation). Restored correct closure for `applyPairLogic` including missing `nx/ny` calculations.

## 4. Diagnostics & Verification
- **New HUD Metrics:**
  - `minPairDist`: Tracks closest approach in continuous collision.
  - `nearOverlapCount`: Tracks pairs within `softR`.
  - `repulsionMaxMag`: Tracks peak force spikes.
- **Pass Criteria:**
  - Dragging node A onto Node B and releasing -> Smooth separation (No explosion).
  - Graph Launch -> No NaN, no instant "teleportation" of nodes.

## 5. Future Work / Hand-off
- **Monitor `softRepulsionExponent`:** We use a dynamic ramp now; verify if `softRepulsionExponent` config is still effective or needs tuning.
- **Init Strategy:** The system implicitly prefers `spread` init. Ensure `ForceConfig.initStrategy` is set to `'spread'` in `app_config.json` or defaults.
- **Constraint Order:** `applyEdgeRelaxation` uses a prime-step rotation. Verify if this eliminates all bias in large linear chains.

## 6. Files Modified
- `src/physics/forces.ts`: Core repulsion logic.
- `src/physics/engine/constraints.ts`: Spacing/Edge logic.
- `src/physics/engine/forcePass.ts`: Pass integration.
