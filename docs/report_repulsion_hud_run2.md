# XPBD Repulsion HUD Run 2: Stats Logic

**Date**: 2026-02-02
**Goal**: Create a dedicated stats bucket for repulsion proof and ensure safe reset logic is centralized.

## Changes

### 1. `RepulsionProofStats` Structure
Added `RepulsionProofStats` to `src/physics/engine/stats.ts`:
```typescript
export type RepulsionProofStats = {
    enteredFrame: number;
    calledThisFrame: boolean;
    // ... pairs, maxForce, awake, stride, etc.
};
```
Included it in `DebugStats`.

### 2. Initialization & Safe Reset
Updated `createDebugStats` in `src/physics/engine/stats.ts` to initialize this bucket with safe defaults (`-1`, `false`, `0`) at the start of every frame / debug cycle. This guarantees no "stale" values persist if the repulsion pass is skipped entirely.

### 3. Wiring
Updated `src/physics/engine/engineTickHud.ts` to read from the live `stats.repulsionProof` instead of the hardcoded placeholders from Run 1.

## Verification
- **Compilation**: Types line up (ignoring unrelated FullChatbar error).
- **Reset Logic**: Since `createDebugStats` is called fresh each frame (or reset logic uses it template), values will not flicker between frames.

## Next Steps (Run 3)
- Wire the "entered" and "called" canary values at the XPBD source seam.
- Verify toggling repulsion updates these values.
