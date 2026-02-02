# RUN 1: XPBD Damping Seam Confirmation

**Date**: 2026-02-02  
**Status**: ✅ CONFIRMED

## XPBD Damping Seam

**File**: `src/physics/engine/engineTickXPBD.ts`  
**Line**: 659  
**Code**: `const effectiveDamping = engine.config.xpbdDamping ?? engine.config.damping;`

**This is the ONLY runtime damping seam for XPBD mode.**

## Legacy Damping Seam

**File**: `src/physics/engine/engineTick.ts`  
**Line**: 269  
**Code**: `const { effectiveDamping } = computeEnergyEnvelope(engine.lifecycle);`

**Legacy damping comes from `computeEnergyEnvelope()`, NOT config.**

## Verification: No Hidden Energy Envelope in XPBD

**Grep for `computeEnergyEnvelope` in XPBD tick**: 0 results  
**XPBD mode does NOT use energy envelope for damping.**

## Code Path Separation

```
XPBD Mode (engineTickXPBD.ts):
  Line 659: effectiveDamping = xpbdDamping ?? damping ← WILL CHANGE
  Line 678: integrateNodes(..., effectiveDamping, ...)

Legacy Mode (engineTick.ts):
  Line 269: effectiveDamping = computeEnergyEnvelope(lifecycle)
  Line 678: integrateNodes(..., effectiveDamping, ...)
```

**Conclusion**: XPBD and legacy have completely separate damping sources. Changing XPBD fallback will NOT affect legacy.
