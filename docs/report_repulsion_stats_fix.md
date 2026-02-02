# XPBD Repulsion Stats Fix

**Date**: 2026-02-02
**Goal**: Logic fix for zero-baseline telemetry on XPBD Repulsion.

## Problem
1. `applyRepulsion` was only updating legacy stats, not the new `xpbdRepulsion*` stats required by the HUD.
2. `engineTickHud.ts` was resetting the `xpbdRepulsion*` stats to 0 *at the start of the snapshot function*, effectively erasing any data collected during the frame before it could be displayed.

## Fixes

### 1. `src/physics/forces.ts`
Updated `applyRepulsion` to write to `stats.safety.xpbdRepulsion*`:
```typescript
// XPBD Telemetry (Fix 1/3: Wire Source)
stats.safety.xpbdRepulsionCalledThisFrame = true;
stats.safety.xpbdRepulsionPairsChecked = pairsChecked;
stats.safety.xpbdRepulsionNodesAffected = pairsApplied * 2;
stats.safety.xpbdRepulsionMaxForce = forceMagMax;
```
This ensures the source of truth flows into the stats object capable of being read by the XPBD HUD section.

### 2. `src/physics/engine/engineTickHud.ts`
Removed lines 106-110 which were resetting `xpbdRepulsion*` values. Reset responsibility lies with `createDebugStats` (start of frame) or `engineTickPreflight`, not the HUD snapshotter (end of frame).

## Verification
- **Zero Baseline**: Should be gone. `Pairs` and `MaxForce` should now reflect actual values (e.g. >0 when nodes interact).
- **HUD**: XPBD Repulsion section will now show live data.

## Note
A syntax error in `src/physics/forces.ts` (extra closing brace from manual edit) was also corrected.
