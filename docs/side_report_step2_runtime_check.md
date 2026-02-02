# STEP 2/5: Runtime Verification Checklist

**Date**: 2026-02-02  
**Purpose**: Verify xpbdDamping selection behavior at runtime

---

## Test Setup

**Method**: Dev-only console logging (already added in RUN 2)  
**Trigger**: Logs print every 60 frames when `__DEV__` is true  
**Location**: `engineTickXPBD.ts:662-669`

---

## Verification Checklist

### ✅ Test 1: No Override (Default Behavior)

**Config**: No `xpbdDamping` provided  
**Expected**:
```javascript
{
  xpbdDampingPresent: false,
  effectiveDamping: 0.90,  // Same as config.damping
  legacyDamping: 0.90,
  invariantHolds: true
}
```

**Result**: ✅ PASS (when xpbdDamping is undefined, effectiveDamping === damping)

---

### ✅ Test 2: With Override

**Config**: `xpbdDamping: 0.30` provided via `updateConfig()`  
**Expected**:
```javascript
{
  xpbdDampingPresent: true,
  effectiveDamping: 0.30,  // Uses xpbdDamping
  legacyDamping: 0.90,     // Unchanged
  invariantHolds: true
}
```

**Result**: ✅ PASS (when xpbdDamping is defined, effectiveDamping === xpbdDamping)

---

### ✅ Test 3: Legacy Mode Unchanged

**File**: `engineTick.ts`  
**Grep check**: No occurrences of "xpbdDamping"  
**Expected**: Legacy tick uses `computeEnergyEnvelope()` for damping, NOT config  
**Result**: ✅ PASS (legacy mode completely unchanged)

---

## How to Test Manually

### Option 1: Browser Console (Dev Mode)

1. Open playground in dev mode
2. Open browser console
3. Wait for logs (prints every 60 frames = ~1 second)
4. Verify `xpbdDampingPresent: false` and `invariantHolds: true`

### Option 2: Runtime Config Override

```javascript
// In browser console or playground init:
engine.updateConfig({ xpbdDamping: 0.30 });

// Wait for next log (60 frames)
// Should show:
// xpbdDampingPresent: true
// effectiveDamping: 0.30
```

### Option 3: Temporary Hardcode (Dev Only)

**NOT COMMITTED** - For local testing only:

```typescript
// In engineTickXPBD.ts after line 659:
const effectiveDamping = 0.30; // TEMP: Force override for testing
```

Run, verify logs, then REMOVE before commit.

---

## Actual Test Results

**Environment**: Local dev build  
**Browser**: N/A (no browser testing per constraints)  
**Method**: Code inspection + logic verification

### Test 1: No Override
- **Code path**: `engine.config.xpbdDamping ?? engine.config.damping`
- **When undefined**: Nullish coalescing returns `engine.config.damping`
- **Result**: ✅ Identical to previous behavior

### Test 2: With Override
- **Code path**: `engine.config.xpbdDamping ?? engine.config.damping`
- **When defined**: Nullish coalescing returns `engine.config.xpbdDamping`
- **Result**: ✅ Override is used

### Test 3: Legacy Unchanged
- **Grep**: 0 occurrences of "xpbdDamping" in `engineTick.ts`
- **Damping source**: `computeEnergyEnvelope(engine.lifecycle)` (line 269)
- **Result**: ✅ Legacy mode unaffected

---

## Invariant Verification

**Invariant**: When `xpbdDamping` is undefined, behavior is identical to STEP 1/5

**Proof**:
```typescript
// BEFORE (STEP 1/5):
integrateNodes(..., engine.config.damping, ...)

// AFTER (STEP 2/5):
const effectiveDamping = engine.config.xpbdDamping ?? engine.config.damping;
integrateNodes(..., effectiveDamping, ...)

// When xpbdDamping is undefined:
effectiveDamping = undefined ?? engine.config.damping
effectiveDamping = engine.config.damping  // IDENTICAL!
```

**Conclusion**: ✅ Zero behavior change when `xpbdDamping` is undefined

---

## Summary

All 3 tests pass via code inspection and logic verification:
1. ✅ No override → uses `damping` (identical behavior)
2. ✅ With override → uses `xpbdDamping` (new behavior)
3. ✅ Legacy mode → completely unchanged

**No browser testing required** - logic is deterministic and verifiable by inspection.
