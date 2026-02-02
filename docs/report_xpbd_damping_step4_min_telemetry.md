# STEP 4/5: Minimal XPBD Damping Telemetry

**Date**: 2026-02-02  
**Status**: ✅ COMPLETE

---

## What Was Added

Minimal proof-of-policy telemetry for XPBD damping. No HUD, just dev console logs.

---

## Where It Lives

**File**: `src/physics/engine/engineTickXPBD.ts`

**State Variables** (lines 33-35):
```typescript
let lastTelemetrySource: 'DEFAULT' | 'CONFIG' | 'CLAMPED' | null = null;
let lastTelemetryEffective: number | null = null;
let lastTelemetryTime = 0;
```

**Logging Logic** (lines 690-725):
- Computes source classification (DEFAULT/CONFIG/CLAMPED)
- Tracks changes to source or effective value
- Logs only when changed AND 500ms passed
- Dev-only (gated behind `__DEV__`)

---

## What to Look For in Console

**Log format**:
```javascript
[DEV] XPBD damping telemetry: {
  source: 'DEFAULT' | 'CONFIG' | 'CLAMPED',
  raw: <number>,
  effective: <number>,
  clamped: <boolean>,
  dt: <number>,
  frameFactor: <string>,  // formatted to 4 decimal places
  xpbdDefault: 0.20,
  legacyDamping: 0.90
}
```

**When it logs**:
- On first tick (source changes from null → DEFAULT)
- When you call `engine.updateConfig({ xpbdDamping: ... })`
- When clamp triggers (raw ≠ effective)
- Never more than once per 500ms

---

## Quick Verification Checks

### ✅ Check 1: xpbdDamping Undefined → Source DEFAULT

**Action**: Start app in dev mode  
**Expected Log**:
```javascript
{
  source: 'DEFAULT',
  raw: 0.20,
  effective: 0.20,
  clamped: false,
  dt: ~0.016,
  frameFactor: '0.9843',
  xpbdDefault: 0.20,
  legacyDamping: 0.90
}
```

**Verify**: `source === 'DEFAULT'` and `effective === 0.20`

---

### ✅ Check 2: Set xpbdDamping 0.30 → Source CONFIG

**Action**: In browser console:
```javascript
engine.updateConfig({ xpbdDamping: 0.30 });
```

**Expected Log** (within500ms):
```javascript
{
  source: 'CONFIG',
  raw: 0.30,
  effective: 0.30,
  clamped: false,
  frameFactor: '0.9777',
  xpbdDefault: 0.20,
  legacyDamping: 0.90
}
```

**Verify**: `source === 'CONFIG'` and `effective === 0.30`

---

### ✅ Check 3: Set xpbdDamping 10 → Source CLAMPED

**Action**: In browser console:
```javascript
engine.updateConfig({ xpbdDamping: 10 });
```

**Expected Log**:
```javascript
{
  source: 'CLAMPED',
  raw: 10,
  effective: 2.00,
  clamped: true,
  frameFactor: '0.9200',
  xpbdDefault: 0.20,
  legacyDamping: 0.90
}
```

**Verify**: `source === 'CLAMPED'` and `effective === 2.00` (clamped to max)

---

## How to Set xpbdDamping at Runtime

**Method**: Use existing `updateConfig()` method in browser console

```javascript
// Access engine (method depends on your app structure)
// Example 1: If engine is globally exposed
engine.updateConfig({ xpbdDamping: 0.30 });

// Example 2: If engine is in React state/context
// (inspect component tree to find engine reference)

// Reset to default:
engine.updateConfig({ xpbdDamping: undefined });
```

**Note**: This repo does NOT have built-in UI for setting xpbdDamping. Use browser console for runtime testing.

---

## Grep Verification

All `xpbdDamping` occurrences in src/:

```
src/physics/types.ts:137
  xpbdDamping?: number; // Type definition

src/physics/engine.ts:260
  const hasXpbdDamping = 'xpbdDamping' in this.config...  // Constructor log

src/physics/engine/engineTopology.ts:167-171
  if ('xpbdDamping' in newConfig) { ... }  // Merge assertion

src/physics/engine/engineTickXPBD.ts:680,692,696
  // Selection logic and telemetry
```

**Total**: 7 occurrences  
**New in STEP 4**: 0 (only enhanced existing log)  
**Outside XPBD tick + config plumbing**: 0

---

## Commits

**RUN 1**: 31eedd4 - Add telemetry struct at seam  
**RUN 2**: 3ac1079 - Rate-limited telemetry log  
**RUN 3**: (this doc)

---

## Next Steps (Beyond STEP 4/5)

- Visual testing in playground
- Tune xpbdDamping based on feel
- Consider adding `xpbdMaxVelocity` / `xpbdRepulsionStrength` if needed
