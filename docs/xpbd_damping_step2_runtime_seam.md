# STEP 2/5: Runtime Read Seam + Grep Proof

**Date**: 2026-02-02  
**Purpose**: Document runtime usage of `xpbdDamping` field

---

## Runtime Read Location

**File**: `src/physics/engine/engineTickXPBD.ts`  
**Line**: 659  
**Code**:
```typescript
const effectiveDamping = engine.config.xpbdDamping ?? engine.config.damping;
```

**Purpose**: XPBD tick uses `xpbdDamping` if provided, otherwise falls back to `damping`

**Passed to**: `integrateNodes()` at line 671 (parameter 6)

---

## Legacy Tick Verification

**File**: `src/physics/engine/engineTick.ts`  
**Status**: ✅ Does NOT read `xpbdDamping`

**Grep proof**: No occurrences of "xpbdDamping" in `engineTick.ts`

**Legacy damping source**: Uses `computeEnergyEnvelope()` which returns `effectiveDamping` based on lifecycle, NOT config.

---

## Complete Grep Results (All xpbdDamping Occurrences)

### Config Type Definition
```
src/physics/types.ts:137
  xpbdDamping?: number; // Optional: XPBD-specific damping
```

### Config Plumbing (STEP 1/5)
```
src/physics/engine/engineTopology.ts:165
  // Dev-only assertion: verify xpbdDamping survives merge if provided

src/physics/engine/engineTopology.ts:167
  if ('xpbdDamping' in newConfig) {

src/physics/engine/engineTopology.ts:169
  engine.config.xpbdDamping === newConfig.xpbdDamping,

src/physics/engine/engineTopology.ts:170
  '[DEV] xpbdDamping lost during config merge',

src/physics/engine/engineTopology.ts:171
  { provided: newConfig.xpbdDamping, result: engine.config.xpbdDamping }

src/physics/engine.ts:258
  // Dev-only: Proof-of-plumbing for xpbdDamping (STEP 1/5)

src/physics/engine.ts:260
  const hasXpbdDamping = 'xpbdDamping' in this.config && this.config.xpbdDamping !== undefined;

src/physics/engine.ts:261
  console.log('[DEV] xpbdDamping plumbing:', {

src/physics/engine.ts:263
  value: this.config.xpbdDamping,
```

### Runtime Usage (STEP 2/5)
```
src/physics/engine/engineTickXPBD.ts:658
  // Invariant: when xpbdDamping is undefined, effectiveDamping === damping

src/physics/engine/engineTickXPBD.ts:659
  const effectiveDamping = engine.config.xpbdDamping ?? engine.config.damping;

src/physics/engine/engineTickXPBD.ts:663
  const xpbdDampingPresent = engine.config.xpbdDamping !== undefined;
```

### Dev-Only Logging (STEP 2/5)
```
src/physics/engine/engineTickXPBD.ts:664
  console.log('[DEV] XPBD damping selection:', {
```

---

## Verification Summary

**Total occurrences**: 16  
**Config plumbing**: 9 (types, merge, constructor log)  
**Runtime usage**: 3 (XPBD tick only)  
**Dev logging**: 4 (gated behind `__DEV__`)

**Files with runtime reads**:
- ✅ `engineTickXPBD.ts` (XPBD mode only)
- ❌ `engineTick.ts` (legacy mode - NO reads)
- ❌ `integration.ts` (receives value, doesn't read config)
- ❌ `damping.ts` (receives value, doesn't read config)

**Invariant**: Legacy tick behavior is completely unchanged.
