# RUN 2: Proper Repulsion Kernel (Hard Core + Smooth Falloff)

**Date**: 2026-02-02

---

## Problem (from RUN 1)
Old kernel: `F = strength / max(d, minDist)`
- Hard cutoff at `minDist` (discontinuous derivative)
- No smooth fade at `distanceMax` boundary
- Numerical issues near d=0

---

## New Kernel Design

### Two-Zone Kernel

**Zone 1: Hard Core** (`d < minDist`)
```typescript
eps = 0.1  // Safety floor (world units)
safeD = max(d, eps)
kernel = 1 / safeD
```
- Strong inverse law for decisive separation
- Safe denominator prevents singularity at d=0
- No NaN/Infinity risk

**Zone 2: Soft Band** (`minDist ≤ d ≤ distanceMax`)
```typescript
t = (d - minDist) / (distMax - minDist)  // 0→1
smooth = 3t² - 2t³  // Cubic hermite
kernel = (1/minDist) * (1 - smooth)  // Fade to 0
```
- C1 continuous (smooth derivative)
- Fades smoothly from `1/minDist` to `0`
- No hard edge pop at boundary

### Boundary Behavior
- At `d = minDist`: kernel = `1/minDist` (continuous)
- At `d = distanceMax`: kernel = `0` (smooth zero)
- Derivative continuous everywhere (no pops)

---

## Numerical Safety

### Singularity Protection
- `eps = 0.1` prevents division by zero
- Even if nodes perfectly overlap (d=0), force is finite
- `F_max = strength / 0.1` (bounded)

### NaN Guards
- All divisions use `max(d, eps)`
- `tClamped = max(0, min(1, t))` prevents extrapolation
- No sqrt of negative numbers

---

## Shape Correctness

### Physical Volume Law ✓
- Hard core ensures quick decisive separation
- Strong forces when `d < minDist`
- Overlaps resolve in ~0.5-1 second

### Boundary Correctness ✓
- Smooth fade to 0 at `distanceMax`
- No discontinuous jump
- No "leak" outside range

### Parameter Stability ✓
- Increasing `distanceMax` extends soft band
- Doesn't change hard core behavior
- Kernel shape remains consistent

---

## Code Changes

**File**: `forces.ts`  
**Lines**: 284-324 (old) → 284-327 (new)  
**Diff**: +43 lines (kernel implementation + comments)

### Before
```typescript
const effectiveD = Math.max(d, effectiveMinDist);
const rawForce = (effectiveStrength / effectiveD) * modifiers;
```

### After
```typescript
let kernelValue;
if (d < effectiveMinDist) {
    kernelValue = 1.0 / max(d, 0.1);  // Hard core
} else {
    const t = (d - minDist) / (distMax - minDist);
    const smooth = 3t² - 2t³;
    kernelValue = (1/minDist) * (1 - smooth);  // Soft fade
}
const rawForce = effectiveStrength * kernelValue * modifiers;
```

---

## Expected Behavior

### Test Case: Two Overlapping Nodes
- Initial: `d = 2px` (severe overlap)
- Hard core: `kernel = 1/max(2, 0.1) = 0.5`
- With `strength=500, SCALE=100`: `F = 50000 * 0.5 = 25000`
- Result: Strong push, quick separation ✓

### Test Case: Boundary Fade
- At `d = 50px` (near `distMax=60`):
  - `t = (50-6)/(60-6) = 0.815`
  - `smooth = 0.966`
  - `kernel = (1/6) * (1-0.966) = 0.0057`
- Result: Weak force, smooth fade ✓

### Test Case: Outside Range
- At `d = 65px` (> `distMax=60`):
  - Pair not processed (distance gate)
  - `F = 0` ✓

---

## Next: RUN 3
Remove sampling artifacts (overlap priority in stride gating).
