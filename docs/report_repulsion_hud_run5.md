# XPBD Repulsion HUD Run 5: Context & Verification

**Date**: 2026-02-02
**Goal**: Complete the telemetry suite with context counters and provide a user verification recipe.

## Changes

### 1. `src/physics/engine/engineTickXPBD.ts`
Added context counters to the stats update block:
```typescript
// Run 5: Context Counters
debugStats.repulsionProof.awakeCount = activeNodes.length;
debugStats.repulsionProof.sleepingCount = sleepingNodes.length;
debugStats.repulsionProof.stride = pairStride;
```
This proves *why* repulsion might be behaving a certain way (e.g., if stride is high, or if all nodes are sleeping).

## Final Verification Recipe

### Test A: Proof of Life
1. **Enable Repulsion**: Ensure `xpbdRepulsionEnabled: true` in config (or via toggle).
2. **Check HUD**: Look for the yellow **Repulsion Proof** section.
   - `Enabled`: YES
   - `Entered`: [Updates every frame]
   - `Called`: YES
3. **Success**: The code path is definitely running.

### Test B: Force Generation
1. **Drag a Node**: Drag a node close to another node.
2. **Observe HUD**:
   - `Pairs`: Should be > 0 (checked) / > 0 (applied).
   - `MaxForce`: Should match `repulsionMaxForceConfig` (e.g., 1200) if very close.
3. **Success**: Forces are being generated and clamped.
4. **Note**: If `MaxForce` is 0 but nodes overlap, check `repulsionMinDistance` config.

### Test C: Stride Policy
1. **Spawn 60 Nodes**: Expect `Stride: 1`.
2. **Spawn 500 Nodes**: Expect `Stride: 3` (or similar, per policy).
3. **Drag Node**: Expect `Stride` to halve (e.g., 3 -> 1 or 2) while dragging.
4. **Success**: Stride adapts to load and interaction.

## Deliverables Summary
- **5 Runs Correctly Executed**
- **HUD Section Added**: "Repulsion Proof (Run 1)"
- **Stats Wired**: `stats.ts`, `engineTickPreflight.ts`, `engineTickHud.ts`
- **Source Hooks**: `engineTickXPBD.ts` (canary, context), `forces.ts` (pairs/mag)
- **Zero Logic Changes**: Physics math untouched.

Ready for user visual testing.
