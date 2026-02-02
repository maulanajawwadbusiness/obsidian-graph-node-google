# STEP 2/5 Complete: xpbdDamping Runtime Usage

**Date**: 2026-02-02  
**Status**: ✅ COMPLETE

---

## What Changed

### File: `src/physics/engine/engineTickXPBD.ts`

**Lines Modified**: 657-671

**Changes**:
1. Added `effectiveDamping` calculation using xpbdDamping override (line 659)
2. Added dev-only logging for proof-of-use (lines 661-669)
3. Passed `effectiveDamping` to `integrateNodes()` instead of `engine.config.damping` (line 673)

**Diff**:
```typescript
// BEFORE:
integrateNodes(
    engine as any,
    nodeList,
    dt,
    1.0,
    motionPolicy,
    engine.config.damping,  // ← Direct config read
    engine.config.maxVelocity,
    debugStats,
    false,
    true
);

// AFTER:
// STEP 2/5: XPBD-specific damping override
// Invariant: when xpbdDamping is undefined, effectiveDamping === damping (zero behavior change)
const effectiveDamping = engine.config.xpbdDamping ?? engine.config.damping;

// Dev-only: Proof-of-use for xpbdDamping override
if (typeof window !== 'undefined' && (window as any).__DEV__ && engine.frameIndex % 60 === 0) {
    const xpbdDampingPresent = engine.config.xpbdDamping !== undefined;
    console.log('[DEV] XPBD damping selection:', {
        xpbdDampingPresent,
        effectiveDamping,
        legacyDamping: engine.config.damping,
        invariantHolds: !xpbdDampingPresent ? effectiveDamping === engine.config.damping : true
    });
}

integrateNodes(
    engine as any,
    nodeList,
    dt,
    1.0,
    motionPolicy,
    effectiveDamping,  // ← Uses override if provided
    engine.config.maxVelocity,
    debugStats,
    false,
    true
);
```

---

## Invariants

### Invariant 1: Zero Behavior Change When Undefined

**Statement**: When `xpbdDamping` is undefined, XPBD tick behaves identically to STEP 1/5.

**Proof**:
```typescript
const effectiveDamping = undefined ?? engine.config.damping;
// Result: effectiveDamping = engine.config.damping (IDENTICAL)
```

### Invariant 2: Legacy Mode Unchanged

**Statement**: Legacy tick (`engineTick.ts`) does not read `xpbdDamping` and is completely unaffected.

**Proof**: Grep shows 0 occurrences of "xpbdDamping" in `engineTick.ts`.

### Invariant 3: No Default Value

**Statement**: `xpbdDamping` has no default value in `DEFAULT_PHYSICS_CONFIG`.

**Verification**: Checked `config.ts` - no `xpbdDamping` field in defaults.

**Result**: Field is absent unless user explicitly provides it.

### Invariant 4: Config Updates Trigger Wake

**Statement**: Changing `xpbdDamping` via `updateConfig()` triggers `wakeAll()` and `invalidateWarmStart()`.

**Proof**: `updateEngineConfig()` in `engineTopology.ts` calls both (lines 176-177).

---

## How to Verify in 60 Seconds

### Quick Test 1: No Override (Default)

```javascript
// In browser console (dev mode):
// 1. Open playground
// 2. Wait for console log (every 60 frames)
// 3. Verify output:
{
  xpbdDampingPresent: false,
  effectiveDamping: 0.90,
  legacyDamping: 0.90,
  invariantHolds: true
}
```

### Quick Test 2: With Override

```javascript
// In browser console (dev mode):
engine.updateConfig({ xpbdDamping: 0.30 });

// Wait for next log (60 frames)
// Verify output:
{
  xpbdDampingPresent: true,
  effectiveDamping: 0.30,
  legacyDamping: 0.90,
  invariantHolds: true
}
```

### Quick Test 3: Grep Verification

```bash
# Verify xpbdDamping only in expected locations:
grep -r "xpbdDamping" src/physics/

# Should show:
# - types.ts (type definition)
# - engine.ts (constructor log)
# - engineTopology.ts (merge assertion)
# - engineTickXPBD.ts (runtime usage)
# - NO occurrences in engineTick.ts (legacy)
```

---

## Clean-up Checklist

- ✅ No stray debug overrides (no hardcoded values)
- ✅ No accidental defaults (checked `config.ts`)
- ✅ Config updates trigger wake (verified `engineTopology.ts`)
- ✅ Dev logs gated behind `__DEV__` (production unaffected)
- ✅ Legacy mode unchanged (grep verified)

---

## Commit Summary

### Commit 1: d8926a2
**Message**: `xpbd(damping): use xpbdDamping override with fallback (step 2/5)`  
**Changes**: Added `effectiveDamping` calculation and passed to `integrateNodes()`

### Commit 2: d5dbe72
**Message**: `dev(xpbd): proof-of-use for xpbdDamping override (step 2/5)`  
**Changes**: Added dev-only logging and invariant comment

### Commit 3: e0e2c72
**Message**: `docs(xpbd): record runtime read seam + grep proof (step 2/5)`  
**Changes**: Created `xpbd_damping_step2_runtime_seam.md` with grep results

### Commit 4: 3bab1eb
**Message**: `test(xpbd): runtime verify xpbdDamping selection (step 2/5)`  
**Changes**: Created `side_report_step2_runtime_check.md` with verification checklist

### Commit 5: (pending)
**Message**: `chore(xpbd): finalize step 2/5 xpbdDamping runtime usage`  
**Changes**: This completion report

---

## Next Steps (STEP 3/5)

- Add actual config values for `xpbdDamping` in defaults or playground
- Test with real physics scenarios
- Tune damping values based on forensic report recommendations

**STEP 2/5 is COMPLETE**: Runtime usage added with zero behavior change when undefined.
