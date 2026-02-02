# RUN 2: XPBD Force Multiplier

**Date**: 2026-02-02  
**Fix**: Added `XPBD_REPULSION_SCALE = 100` multiplier

---

## Problem (from RUN 1)
Forces generated but too weak for XPBD scale:
- `F = 500 / 30 ≈ 17` (weak)
- After integration: `dv = F * dt ≈ 17 * 0.016 ≈ 0.27 px/s`
- After damping: `dv *= 0.98 ≈ 0.26 px/s`
- After one frame: `dx = dv * dt ≈ 0.004 px` (invisible!)

Compare to springs:
- Spring with `k=0.2`, `Δx=100px`: `F ≈ 20`
- But springs get XPBD position-based solver boost

## Surgical Fix
**Added XPBD_REPULSION_SCALE = 100** in `forces.ts:55`

```typescript
const XPBD_REPULSION_SCALE = 100;
let effectiveStrength = repulsionStrength * XPBD_REPULSION_SCALE;
```

### New Force Magnitude
- `F = (500 * 100) / 30 ≈ 1667` at d=30px
- `F = (500 * 100) / 10 ≈ 5000` at d=10px (close overlap)

### Expected Magnitude Chain
```
[Magnitude Chain Frame X] {
  1_maxF: "1667-5000",    // Boosted ✓
  1_forcePairs: 20-50,
  2_damping: "0.200",
  2_maxVCap: "1000.0",
  3_maxDV: "26-80",       // Should be visible now
  3_dvNodes: 50+,
  4_maxDX: "0.4-1.3",     // Should move visibly
  4_dxNodes: 50+
}
```

## Why This Works
1. **Scale match**: Repulsion now competes with XPBD edge constraints
2. **Config unchanged**: User still sets `repulsionStrength=500` (sane value)
3. **Minimal diff**: Single multiplier, no structural changes
4. **XPBD-only**: Doesn't affect legacy mode (if it still exists)

## Changes
**File**: `src/physics/forces.ts`
**Lines**: 46-61
**Diff**: +9 lines (documentation + multiplier)

---

## Verification Plan (for user)
1. Launch app with `repulsionStrength=500`
2. Spawn 10-20 nodes with sparse links
3. Check console for improved magnitude chain
4. Verify overlapping nodes now separate visibly in 1-3 seconds
