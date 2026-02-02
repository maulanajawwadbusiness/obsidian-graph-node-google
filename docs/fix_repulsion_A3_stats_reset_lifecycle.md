# Fix Repulsion A3: Stats Reset Lifecycle

**Date**: 2026-02-02  
**Goal**: Ensure repulsion counters persist long enough to be observed and don't flicker to zero immediately after being set.

## Problem
Repulsion stats were being reset at frame-start, but if repulsion ran intermittently (e.g., only when nodes are close), the HUD would show zeros most of the time, making it impossible to verify execution.

## Changes

### 1. `src/physics/engine/physicsHud.ts`
Added lastFrame snapshot fields:
```typescript
// Mini Run 3 (A3): LastFrame Snapshots (prevent flickering)
repulsionCalledLastFrame?: boolean;
repulsionPairsCheckedLastFrame?: number;
repulsionPairsAppliedLastFrame?: number;
repulsionMaxForceMagLastFrame?: number;
```

### 2. `src/physics/engine/engineTickHud.ts`
Captured previous frame values before reset:
```typescript
// Mini Run 3 (A3): LastFrame Snapshots
// Capture previous frame values before reset (from engine.hudSnapshot)
repulsionCalledLastFrame: engine.hudSnapshot?.repulsionProofCalledThisFrame ?? false,
repulsionPairsCheckedLastFrame: engine.hudSnapshot?.repulsionProofPairsChecked ?? 0,
repulsionPairsAppliedLastFrame: engine.hudSnapshot?.repulsionProofPairsApplied ?? 0,
repulsionMaxForceMagLastFrame: engine.hudSnapshot?.repulsionProofMaxForce ?? 0,
```

### 3. `src/playground/components/CanvasOverlays.tsx`
Updated HUD display to show both current and last frame values:
```tsx
Called: {hud.repulsionProofCalledThisFrame ? 'YES' : 'NO'} 
<span style={{ color: '#888', fontSize: '9px' }}> (Last: {hud.repulsionCalledLastFrame ? 'YES' : 'NO'})</span>
```

## Verification Checklist
- ✅ If repulsion runs intermittently, lastFrame shows it clearly
- ✅ Numbers do not flicker to 0 immediately after being set
- ✅ HUD shows both current frame and last frame values in gray

## Summary
All three mini runs complete:
- **A1**: `xpbdRepulsionEnabled` now defaults to true and has HUD toggle
- **A2**: `Mode: XPBD` displays prominently in green in HUD
- **A3**: LastFrame snapshots prevent telemetry from being hidden

Repulsion execution is now fully verifiable via HUD.
