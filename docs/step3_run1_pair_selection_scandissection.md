# RUN 1: Pair Selection Pipeline Scandissection

**Date**: 2026-02-02

---

## Pair Selection Pipeline (Complete Chain)

### 1. Entry Point: `engineTickXPBD.ts:665`
```typescript
applyRepulsion(nodeList, activeNodes, sleepingNodes, config, stats, 
               undefined, pairStride, 0, undefined, engine.links)
```

### 2. Stride Policy (Lines 636-662)
**CRITICAL FINDING**: `pairStride` varies based on node count:

```typescript
if (N > 400 * 1.1) pairStride = 4;      // 25% coverage
else if (N > 200 * 1.1) pairStride = 3; // 33% coverage  
else if (N > 100 * 1.1) pairStride = 2; // 50% coverage
else pairStride = 1;                     // 100% coverage
```

**During drag**: `pairStride = max(1, floor(pairStride/2))`

### 3. Pair Iteration (forces.ts:318-326)
```typescript
for (let i = 0; i < activeNodes.length; i++) {
    for (let j = i + 1; j < activeNodes.length; j++) {
        applyPair(activeNodes[i], activeNodes[j]);  // Active-Active
    }
    for (let j = 0; j < sleepingNodes.length; j++) {
        applyPair(activeNodes[i], sleepingNodes[j]); // Active-Sleeping
    }
}
```

**FINDING**: Sleeping-Sleeping pairs are NEVER checked!

### 4. Stride Gating (forces.ts:76-82)
```typescript
const shouldSkipPair = (a, b) => {
    if (pairStride <= 1) return false;
    const mix = (i * 73856093 + j * 19349663 + pairOffset) % pairStride;
    return mix !== 0;  // Skip if hash doesn't match
};
```

**CRITICAL**: This is called BEFORE distance check!

### 5. Distance Gating (forces.ts:227-236)
```typescript
if (d2 < maxDistSq) {  // Only process if within range
    // ... apply force
}
```

---

## ROOT CAUSE ANALYSIS

### Why `repulsionDistanceMax=150` Makes Repulsion "Disappear"

**Problem Chain**:

1. **Stride Skipping Happens First**
   - At N=150 nodes: `pairStride = 2` (50% coverage)
   - `shouldSkipPair()` runs BEFORE distance check
   - **50% of ALL pairs are skipped** (including close overlaps!)

2. **No Overlap Priority**
   - Stride hash is deterministic but blind to distance
   - A pair at `d=1px` (severe overlap) has same skip chance as `d=100px`
   - **Close pairs can be randomly skipped**

3. **Sleeping Nodes Ignored**
   - If two nodes are both sleeping and overlapping
   - They are NEVER checked (line 318-326 loop structure)
   - **Sleeping overlaps persist forever**

4. **Distance Check is Secondary**
   - Only runs AFTER stride gating
   - Increasing `distanceMax` doesn't help if pair is stride-skipped
   - **Larger range = more pairs to skip = worse coverage**

---

## Specific Failure Modes

### Mode A: "Stride Lottery"
- **Scenario**: 200 nodes, `pairStride=3` (33% coverage)
- **Result**: 67% of close pairs randomly skipped
- **Feel**: Overlaps persist, repulsion feels "weak"

### Mode B: "Sleeping Leak"
- **Scenario**: Two sleeping nodes overlap after settling
- **Result**: Never checked (sleeping-sleeping pairs excluded)
- **Feel**: Permanent overlaps that never resolve

### Mode C: "Distance Paradox"
- **Scenario**: Increase `distanceMax` from 60→150
- **Effect**: More pairs in range, but stride still skips 50-75%
- **Result**: Effective coverage DECREASES (more pairs to skip)
- **Feel**: "Repulsion disappeared"

---

## Why 10^45 "Worked"
With absurdly high strength:
- The 25-33% of pairs that DO get checked apply HUGE forces
- These huge forces compensate for the 67-75% of skipped pairs
- **It's a band-aid, not a fix**

---

## Gates That Cause Leaks

### Gate 1: Stride Hash (BEFORE distance)
**Location**: `forces.ts:76-82`  
**Leak**: Skips close pairs randomly  
**Fix Needed**: Never skip if `d < minDistance`

### Gate 2: Sleep-Sleep Exclusion
**Location**: `forces.ts:318-326` loop structure  
**Leak**: Sleeping overlaps never resolve  
**Fix Needed**: Include sleeping-sleeping pairs OR wake on overlap

### Gate 3: Active-Only Iteration
**Location**: Only `activeNodes` are primary iterators  
**Leak**: Sleeping nodes only checked against active  
**Fix Needed**: Ensure overlap detection wakes nodes

---

## Forensic Summary

**Primary Culprit**: Stride gating runs BEFORE distance check  
**Secondary Culprit**: Sleeping-sleeping pairs excluded  
**Tertiary Culprit**: No overlap priority in sampling

**Why distanceMax increase breaks it**:
- More pairs fall in range
- But stride still skips same % (e.g., 75%)
- Net effect: MORE pairs skipped in absolute terms
- Feels like repulsion "disappeared"

---

## RUN 2 Plan
Fix the kernel shape + add overlap priority to stride gating.
