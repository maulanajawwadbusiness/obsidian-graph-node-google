# Dev Gating Verification Report

**Date**: 2026-02-04  
**Concern**: Ensure `window.__topology` is truly gated at import-time, not just log-time

## Current Implementation

### Layer 1: Import-Time Gating
**File**: `src/playground/GraphPhysicsPlayground.tsx` (Line 33-35)
```typescript
// PRE-STEP2: Only import in dev mode to prevent bundling in production
if (import.meta.env.DEV) {
    import('../graph/devTopologyHelpers');
}
```

**Analysis**:
- ✅ Uses dynamic `import()` inside conditional
- ✅ Vite/webpack will tree-shake this in production builds
- ✅ Module not even bundled if `import.meta.env.DEV === false`

### Layer 2: Runtime Gating
**File**: `src/graph/devTopologyHelpers.ts` (Line 80-87)
```typescript
// PRE-STEP2: Dev-only + browser-only gating
if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as any).__topology = devTopologyHelpers;
    console.log('[DevTopology] Console helpers loaded (DEV MODE). Try: window.__topology.dump()');
} else if (typeof window !== 'undefined') {
    console.log('[DevTopology] Helpers disabled in production build.');
}
```

**Analysis**:
- ✅ Double-check: Even if module loads, window assignment is gated
- ✅ Clear production log message
- ⚠️ **Issue**: The `else if` log will only run if module loads (won't happen in prod due to layer 1)

## Potential Leak Scenario

**Scenario**: If someone accidentally does a static import elsewhere:
```typescript
import { devTopologyHelpers } from '../graph/devTopologyHelpers'; // WRONG
```

**Result**: Module would bundle, runtime gate would catch it, but bundle bloat.

## Strengthened Safeguard

Add top-of-file guard in `devTopologyHelpers.ts`:

```typescript
// CRITICAL: This module should NEVER be bundled in production
// If you see this error, check for static imports of devTopologyHelpers
if (!import.meta.env.DEV) {
    throw new Error('[SECURITY] devTopologyHelpers loaded in production build - CHECK IMPORTS');
}
```

## Verification Plan

1. **Dev build test**: `npm run dev` → `window.__topology` should exist
2. **Prod build test**: `npm run build` + serve → `window.__topology` should be `undefined`
3. **Bundle analysis**: Check dist for `devTopologyHelpers` (should not exist)

## Status

**Current**: ✅ Import-time gating is solid (dynamic import)  
**Risk**: Low (would require deliberate static import bypass)  
**Action**: Add top-of-file guard as extra safeguard  

**Leak protocol**: If `window.__topology` ever appears in production:
1. Check for static imports (grep for `from.*devTopologyHelpers`)
2. Verify Vite env detection
3. Check bundle with `npm run build` + analyze
