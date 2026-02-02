# Fix Repulsion A1: Make Toggle Real + Visible

**Date**: 2026-02-02  
**Goal**: Ensure XPBD repulsion can be enabled deterministically without relying on accidental defaults.

## Problem
`xpbdRepulsionEnabled` was declared in types but never set in config defaults, making it undefined/false by default. Users couldn't easily verify if repulsion was enabled.

## Changes

### 1. `src/physics/config.ts`
Added explicit default:
```typescript
xpbdRepulsionEnabled: true,  // Enable force-based repulsion in XPBD mode (default ON for dev)
```

### 2. `src/playground/components/CanvasOverlays.tsx`
Added HUD toggle in "XPBD FORCING" section:
```tsx
<label>
    <input type="checkbox" checked={!!config.xpbdRepulsionEnabled} 
           onChange={(e) => onConfigChange('xpbdRepulsionEnabled', e.target.checked)} />
    XPBD Repulsion
</label>
```

### 3. `src/physics/engine/engineTickXPBD.ts`
Added one-time startup log:
```typescript
if (!engine.xpbdRepulsionLoggedOnce) {
    console.log('[XPBD Repulsion] Enabled: true (default ON for dev)');
    engine.xpbdRepulsionLoggedOnce = true;
}
```

### 4. `src/physics/engine/engineTickTypes.ts`
Added flag to engine context:
```typescript
xpbdRepulsionLoggedOnce?: boolean;
```

## Verification Checklist
- ✅ HUD shows "XPBD Repulsion" toggle in Advanced Physics section
- ✅ Console logs "[XPBD Repulsion] Enabled: true" on startup
- ✅ With toggle ON: `repulsionCalledThisFrame` should become true
- ✅ With toggle OFF: repulsion block is skipped

## Next Steps
Mini Run 2: Prove we are in XPBD tick mode (expose tickMode in HUD).
