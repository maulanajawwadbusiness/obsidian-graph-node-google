# XPBD Repulsion HUD Run 1: Placeholders

**Date**: 2026-02-02
**Goal**: Add visual container for repulsion telemetry without wiring logic.

## Changes

### 1. `PhysicsHudSnapshot` Update
Added `repulsionProof` fields to `src/physics/engine/physicsHud.ts`:
```typescript
    // Run 1: Repulsion Proof Placeholders
    repulsionProofEnteredFrame?: number;
    repulsionProofCalledThisFrame?: boolean;
    repulsionProofPairsChecked?: number;
    repulsionProofPairsApplied?: number;
    repulsionProofMaxForce?: number;
    // ... active/sleeping counts, stride, enabled
```
renamed from user request to avoid collision with legacy `repulsion*` fields.

### 2. HUD Initialization
Updated `src/physics/engine/engineTickHud.ts` to initialize these to `-1` / `false`.

### 3. Canvas Rendering
Updated `src/playground/components/CanvasOverlays.tsx` to render a new **Repulsion Proof (Run 1)** section:
```tsx
<div style={{ ... color: '#ffcc00' }}>
    <strong>Repulsion Proof (Run 1)</strong><br />
    Enabled: NO | Entered: -1<br />
    Called: NO<br />
    Pairs: -1 chk / -1 app<br />
    MaxForce: -1<br />
    Active: -1 / Sleep: -1<br />
    Stride: -1
</div>
```

## Verification
- **Build**: Failed due to existing `FullChatbar.tsx` error, but HUD types check out.
- **Visual**: Expect to see the yellow "Repulsion Proof" section with "-1" values.

## Risks
- None. Display only.

## Next Steps (Run 2)
- Create a dedicated stats bucket (or ensure safe reset) for these fields.
- Ensure they reset exactly ONCE per frame start.
