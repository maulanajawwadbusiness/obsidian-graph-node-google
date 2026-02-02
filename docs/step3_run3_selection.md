# RUN 3: Switch Selection Logic

**Date**: 2026-02-02  
**Status**: ✅ COMPLETE

## Change

**File**: `src/physics/engine/engineTickXPBD.ts`  
**Line**: 680

### Before (STEP 2/5):
```typescript
const effectiveDamping = engine.config.xpbdDamping ?? engine.config.damping;
```

### After (STEP 3/5):
```typescript
const effectiveDamping = engine.config.xpbdDamping ?? DEFAULT_XPBD_DAMPING;
```

## Behavior Change

| Scenario | BEFORE (STEP 2) | AFTER (STEP 3) |
|----------|-----------------|----------------|
| xpbdDamping = 0.30 | uses 0.30 | uses 0.30 |
| xpbdDamping = undefined | uses config.damping (0.90) | uses DEFAULT_XPBD_DAMPING (0.20) |

## Impact

**XPBD mode now has its own damping** (0.20 by default) instead of inheriting legacy's 0.90.

**Half-life comparison**:
- Legacy (0.90): 0.15s half-life (very tight, forces feel dead)
- XPBD (0.20): 0.69s half-life (responsive, forces visible)

## Dev Log Updated

Now shows `source` field indicating where damping came from:
```javascript
{
  xpbdDampingPresent: false,
  effectiveDamping: 0.20,
  xpbdDefault: 0.20,
  legacyDamping: 0.90,
  source: 'DEFAULT_XPBD_DAMPING'
}
```

## Legacy Unaffected

Legacy mode (`engineTick.ts`) still uses `computeEnergyEnvelope()` for damping.
No changes to legacy path.
