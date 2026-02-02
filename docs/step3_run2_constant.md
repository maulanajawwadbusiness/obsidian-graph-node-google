# RUN 2: Introduce XPBD Default Constant

**Date**: 2026-02-02  
**Status**: ✅ COMPLETE

## Change

**File**: `src/physics/engine/engineTickXPBD.ts`  
**Line**: 29  
**Code**: `export const DEFAULT_XPBD_DAMPING = 0.20;`

## Half-Life Math

**Damping formula**: `v *= exp(-effectiveDamping * 5.0 * dt)`

**Half-life formula**: `t_half = ln(2) / (effectiveDamping * 5.0)`

### Calculation

**Target half-life**: 0.7s (responsive but not too loose)

```
t_half = 0.693 / (effectiveDamping * 5.0)
0.7 = 0.693 / (effectiveDamping * 5.0)
effectiveDamping * 5.0 = 0.693 / 0.7 = 0.99
effectiveDamping = 0.99 / 5.0 = 0.198 ≈ 0.20
```

**Chosen value**: `0.20`  
**Resulting half-life**: `0.693 / (0.20 * 5.0) = 0.693s`

### Comparison

| Mode | Damping | k = damp * 5 | Half-Life | Behavior |
|------|---------|--------------|-----------|----------|
| Legacy (config) | 0.90 | 4.5 | 0.15s | Very tight |
| XPBD (new default) | 0.20 | 1.0 | 0.69s | Responsive |

## Why 0.20?

- **0.15**: Half-life = 0.92s (too loose, floaty)
- **0.20**: Half-life = 0.69s (balanced, responsive)
- **0.25**: Half-life = 0.55s (slightly tight)

**0.20** provides good responsiveness while still feeling controlled.

## No Behavior Change Yet

This commit only adds the constant. Selection logic will change in RUN 3.
