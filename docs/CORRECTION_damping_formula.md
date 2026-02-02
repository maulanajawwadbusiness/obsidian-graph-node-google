# CRITICAL CORRECTION: Damping Formula Discovery

**Date**: 2026-02-02  
**Severity**: CRITICAL - Previous analysis was WRONG

## The Actual Damping Formula

**Location**: `src/physics/engine/velocity/damping.ts:19`

```typescript
node.vx *= Math.exp(-effectiveDamping * 5.0 * nodeDt);
node.vy *= Math.exp(-effectiveDamping * 5.0 * nodeDt);
```

**NOT** `v *= (1 - damping)` as assumed in previous reports!

## Corrected Analysis

### With damping = 0.90, dt = 0.016s (60 FPS):

```
damping_factor = exp(-0.90 * 5.0 * 0.016)
               = exp(-0.072)
               = 0.9305
```

**Velocity retention**: 93.05% per frame (NOT 10%!)

### Frame-by-Frame Decay

| Frame | Velocity Remaining |
|-------|-------------------|
| 0     | 100%              |
| 1     | 93.05%            |
| 10    | 49.7%             |
| 60    | 1.24%             |

**Half-life**: ~10 frames (166ms @ 60 FPS)

### Corrected Numeric Example

With `repulsionStrength = 500`, `d = 30px`:

```
F = 500 / 30 = 16.67
a = 16.67 px/s²
Δv = 16.67 * 0.016 = 0.267 px/s

After damping:
v_damped = 0.267 * 0.9305 = 0.248 px/s

Δx = 0.248 * 0.016 = 0.00397 px/frame
```

**Still sub-pixel, but 10x better than assumed!**

### Steady-State Velocity

```
v_steady = Δv / (1 - damping_factor)
         = 0.267 / (1 - 0.9305)
         = 0.267 / 0.0695
         = 3.84 px/s

Δx_steady = 3.84 * 0.016 = 0.0614 px/frame
```

**Still barely visible, but 150x better than assumed!**

## Why 1e45 Still Needed

Even with corrected damping, `repulsionStrength = 500` produces:
- **0.06 px/frame** (barely visible)
- To achieve **1 px/frame**: need ~16x strength = 8000
- To achieve **3 px/frame**: need ~50x strength = 25000

**User's 1e45 multiplier hits `repulsionMaxForce = 120000` clamp, producing ~2 px/frame.**

## Conclusion

Previous analysis was based on wrong damping formula, but **conclusion remains valid**:
- Damping is still too high (though not as catastrophic as thought)
- `repulsionStrength = 500` is still too weak
- Recommended fixes still apply (but with adjusted values)

## Updated Recommendations

1. **damping: 0.90 → 0.30** (was 0.05, now less aggressive)
2. **repulsionStrength: 500 → 8000** (was 5000, now higher)
3. **maxVelocity: 80 → 200** (unchanged)
