# XPBD Repulsion HUD Run 3: Canary Wiring

**Date**: 2026-02-02
**Goal**: Wire the "Entered" and "Called" canary values to the actual execution path.

## Changes

### 1. `src/physics/engine/engineTickXPBD.ts`
Inside the `if (xpbdRepulsionEnabled)` block, specifically right after `applyRepulsion` runs:

```typescript
// Run 3: Repulsion Proof Canary (Source of Truth)
debugStats.repulsionProof.enteredFrame = engine.frameIndex;
debugStats.repulsionProof.calledThisFrame = true;
debugStats.repulsionProof.enabled = true;
```

This ensures that:
1. `enteredFrame` updates ONLY if the block is entered (proving config works).
2. `calledThisFrame` becomes true ONLY if the function call completes (proving logic flow).
3. `enabled` reflects local source truth.

## Verification
- **Toggle Off**: `enteredFrame` stays at `-1` (from reset), `called` stays `false`.
- **Toggle On**: `enteredFrame` updates to current frame index, `called` becomes `true`.

## Risks
- None. Telemetry only.

## Next Steps (Run 4)
- Instrument `applyRepulsion` (or the call site) to capture `pairsChecked`, `pairsApplied`, and `maxForce` into the new stats bucket.
