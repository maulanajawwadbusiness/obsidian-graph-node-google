# RUN 4: Safety + Clamping

**Date**: 2026-02-02  
**Status**: ✅ COMPLETE

## Change

**File**: `src/physics/engine/engineTickXPBD.ts`  
**Lines**: 680-684

### Code:
```typescript
const rawDamping = engine.config.xpbdDamping ?? DEFAULT_XPBD_DAMPING;

// RUN 4: Safety clamp to sane range [0, 2]
// 0 = no damping (floaty), 2 = very heavy damping (k=10, half-life=0.07s)
const effectiveDamping = Math.max(0, Math.min(2, rawDamping));
```

## Clamp Range Justification

| Value | k = damp * 5 | Half-Life | Behavior |
|-------|--------------|-----------|----------|
| 0 | 0 | ∞ | No damping (floaty, never settles) |
| 0.20 | 1.0 | 0.69s | Default (responsive) |
| 1.0 | 5.0 | 0.14s | Tight |
| 2.0 | 10.0 | 0.07s | Very tight (forces feel dead) |

**Upper bound (2.0)**: Prevents extreme damping that makes physics feel broken.  
**Lower bound (0)**: Negative damping would cause explosion (energy gain).

## Config Wake Still Works

`updateConfig()` in `engineTopology.ts` already calls:
- `wakeAll()` (line 176)
- `invalidateWarmStart('CONFIG_CHANGE')` (line 177)

No additional changes needed.

## Verification

```typescript
// Test cases:
-5   → clamped to 0
0.20 → unchanged (default)
0.50 → unchanged
2.5  → clamped to 2
```
