# RUN 3: Remove Sampling Artifacts (Overlap Priority)

**Date**: 2026-02-02

---

## Problem (from RUN 1)
Stride gating runs BEFORE distance check:
```typescript
// OLD ORDER (BROKEN)
pairsConsidered++;
if (shouldSkipPair(a, b)) return;  // ← Skips 50-75% randomly
const d = distance(a, b);           // ← Never reached for skipped pairs
```

**Result**: Close overlapping pairs get randomly skipped!

---

## Fix: Overlap Priority

### New Order
```typescript
// NEW ORDER (FIXED)
pairsConsidered++;
const d = distance(a, b);           // ← Calculate FIRST
const isOverlap = d < minDistance;  // ← Detect hard core
if (!isOverlap && shouldSkipPair(a, b)) return;  // ← Only skip soft band
```

### Critical Rule
**NEVER skip pairs where `d < repulsionMinDistance`**

- Hard core pairs ALWAYS processed (100% coverage)
- Soft band pairs can be sampled (stride gating allowed)
- Overlap resolution is guaranteed

---

## Code Changes

**File**: `forces.ts`  
**Lines**: 203-235

### Before
```typescript
const applyPair = (a, b) => {
    pairsConsidered++;
    if (shouldSkipPair(a, b)) return;  // ← WRONG: skips before distance check
    
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d = sqrt(dx² + dy²);
    // ...
};
```

### After
```typescript
const applyPair = (a, b) => {
    pairsConsidered++;
    
    // Calculate distance FIRST
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d = sqrt(dx² + dy²);
    
    // OVERLAP PRIORITY: never skip close pairs
    const isOverlap = d < repulsionMinDistance;
    if (!isOverlap && shouldSkipPair(a, b)) return;  // ← CORRECT
    
    // ...
};
```

---

## Impact

### Before (Broken)
- N=200 nodes, `pairStride=3` (33% coverage)
- **67% of ALL pairs skipped** (including overlaps!)
- Close pair at d=2px: 67% chance of being skipped
- Result: Overlaps persist, feel "leaky"

### After (Fixed)
- N=200 nodes, `pairStride=3`
- **Hard core pairs: 100% coverage** (never skipped)
- **Soft band pairs: 33% coverage** (sampled)
- Close pair at d=2px: ALWAYS processed
- Result: Overlaps resolve decisively ✓

---

## Why This Fixes "distanceMax Paradox"

### Old Behavior
- Increase `distanceMax` from 60→150
- More pairs fall in range
- But stride still skips 67% of ALL pairs
- Net: MORE absolute pairs skipped
- Feel: "Repulsion disappeared"

### New Behavior
- Increase `distanceMax` from 60→150
- More pairs fall in soft band
- Hard core pairs STILL 100% covered
- Soft band sampling doesn't affect overlap resolution
- Feel: "Repulsion extended range" ✓

---

## Performance Impact

### Computation Cost
- **Before**: Skip check is O(1) hash
- **After**: Distance calc (sqrt) before skip check
- **Cost**: ~1 sqrt per pair considered

### Coverage
- **Before**: 25-33% of all pairs (including overlaps)
- **After**: 100% of overlaps + 25-33% of soft band
- **Benefit**: Guaranteed overlap resolution

### Net Effect
- Slightly more computation (distance calc earlier)
- But MUCH better correctness (no missed overlaps)
- Performance impact negligible (sqrt is fast)

---

## Remaining Issue: Sleeping-Sleeping Pairs
**Still not fixed** (will address if needed):
- Loop structure only checks active-active and active-sleeping
- Sleeping-sleeping pairs still excluded
- May need to add wake-on-overlap logic

---

## Next: RUN 4
World-units invariance check (ensure no px/screen conversions).
