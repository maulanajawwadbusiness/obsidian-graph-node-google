# XPBD Repulsion HUD Run 4: Pair & Magnitude Wiring

**Date**: 2026-02-02
**Goal**: Instrument the actual repulsion logic to report pairs checked/applied and force magnitude.

## Changes

### 1. `src/physics/forces.ts`
Updated `applyRepulsion` to write local counters to `stats.repulsionProof` at the end of execution:

```typescript
    // Run 4: Repulsion Proof Telemetry (Unique Bucket)
    if (stats && stats.repulsionProof) {
        stats.repulsionProof.pairsChecked = pairsChecked;
        stats.repulsionProof.pairsApplied = pairsApplied;
        stats.repulsionProof.maxForce = forceMagMax;
    }
```

This captures the *actual* work done by the loop, including skipping due to stride or distance, and processing due to overlap.

## Logic Flow
1. `applyRepulsion` initializes `pairsChecked = 0`, `forceMagMax = 0`.
2. Loops over nodes.
3. Every call to `applyPair` increments `pairsChecked`.
4. If overlap detected (`d2 < maxDistSq`), calculates force.
5. `forceMagMax` tracks peak force.
6. `pairsApplied` increments.
7. Finally, stats are updated.

## Verification
- **Pairs**: Expect > 0 for any graph N > 1 (unless stride skips all, which is unlikely for small N).
- **MaxForce**: Expect > 0 if nodes are close (within 60px).
- **HUD**: HUD should now show non-negative numbers for Pairs and MaxForce instead of `-1`.

## Risks
- None. Only writing stats.

## Next Steps (Run 5)
- Add context counters (Awake/Sleeping counts, Stride used).
- Provide final manual verification recipe.
