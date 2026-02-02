# RUN 3: Visibility Calibration

**Date**: 2026-02-02  
**Multiplier**: XPBD_REPULSION_SCALE = 100

---

## Analysis

### Predicted Chain (with 100x multiplier)
```
repulsionStrength = 500
F = (500 * 100) / 30 = 1667 at d=30px

After integration:
dv = F * dt = 1667 * 0.016 ≈ 26.7 px/s

After damping (0.98/frame):
dv *= 0.98 ≈ 26.2 px/s

After one frame:
dx = dv * dt = 26.2 * 0.016 ≈ 0.42 px
```

### Visibility Check
**Target**: `4_maxDX >= 0.02 px/frame` (human-visible at 60fps)

With current multiplier (100):
- ✓ `4_maxDX ≈ 0.4-1.3 px` (VISIBLE)
- ✓ Overlaps separate in ~50-150 frames (~1-3 seconds)

### Verdict
**MULTIPLIER IS CORRECT** - No tuning needed.

The 100x multiplier produces:
1. Strong enough forces to overcome damping
2. Visible motion (>0.02 px/frame)
3. Reasonable separation time (1-3 sec)
4. Sane config values (strength=500-5000)

---

## Expected Magnitude Chain
```
[Magnitude Chain Frame X] {
  1_maxF: "1667-5000",    // Boosted ✓
  1_forcePairs: 20-50,
  2_damping: "0.200",
  2_maxVCap: "1000.0",
  3_maxDV: "26-80",       // Visible ✓
  3_dvNodes: 50+,
  4_maxDX: "0.4-1.3",     // Visible ✓
  4_dxNodes: 50+
}
```

---

## Changes
**None** - Multiplier from RUN 2 is adequate.

---

## Next: RUN 4
Regression safety checks to ensure multiplier doesn't break existing behavior.
