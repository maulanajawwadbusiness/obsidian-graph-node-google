# Fix Repulsion A2: Prove XPBD Tick Mode

**Date**: 2026-02-02  
**Goal**: Remove ambiguity about which tick path is running by exposing tickMode in HUD.

## Problem
Users couldn't easily verify if XPBD mode was actually active. The `mode` field existed in the HUD snapshot but wasn't prominently displayed.

## Changes

### 1. `src/playground/components/CanvasOverlays.tsx`
Added prominent tickMode display in Physics Stats section:
```tsx
<span style={{ color: hud?.mode === 'XPBD' ? '#0f0' : '#fa0', fontWeight: 'bold' }}>
    Mode: {hud?.mode || 'UNKNOWN'}
</span>
```
- Green (#0f0) for XPBD mode
- Orange (#fa0) for LEGACY mode

### 2. `src/physics/engine/engineTick.ts`
Added mode selection log in `runPhysicsTick` dispatcher:
```typescript
if (!engine.tickModeLoggedOnce) {
    const mode = engine.config.useXPBD ? 'XPBD' : 'LEGACY';
    console.log(`[Physics Tick] Mode selected: ${mode}`);
    engine.tickModeLoggedOnce = true;
}
```

### 3. `src/physics/engine/engineTickTypes.ts`
Added flag to engine context:
```typescript
tickModeLoggedOnce?: boolean;
```

## Verification Checklist
- ✅ HUD shows "Mode: XPBD" in green in Physics Stats section
- ✅ Console logs "[Physics Tick] Mode selected: XPBD" on startup
- ✅ If config.useXPBD is false, HUD shows "Mode: LEGACY" in orange

## Next Steps
Mini Run 3: Fix stats reset lifecycle to prevent telemetry from being hidden.
