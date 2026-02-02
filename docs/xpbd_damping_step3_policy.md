# STEP 3/5 Policy: XPBD Damping Separation

**Date**: 2026-02-02  
**Status**: ✅ COMPLETE

---

## Summary

XPBD mode now has its own damping policy, completely separate from legacy `config.damping`.

---

## Old Behavior (STEP 2/5)

```typescript
const effectiveDamping = engine.config.xpbdDamping ?? engine.config.damping;
```

**Problem**: When `xpbdDamping` was undefined, XPBD inherited legacy's `damping = 0.90` (half-life = 0.15s), making forces feel dead.

---

## New Behavior (STEP 3/5)

```typescript
const rawDamping = engine.config.xpbdDamping ?? DEFAULT_XPBD_DAMPING;
const effectiveDamping = Math.max(0, Math.min(2, rawDamping));
```

**Solution**: XPBD uses its own default (`0.20`) with half-life = 0.69s, making forces visible and responsive.

---

## Half-Life Math

**Damping formula**: `v *= exp(-effectiveDamping * 5.0 * dt)`

**Half-life formula**: `t_half = ln(2) / (effectiveDamping * 5.0)`

| Mode | Damping | k = damp × 5 | Half-Life | Feel |
|------|---------|--------------|-----------|------|
| Legacy | 0.90 | 4.5 | 0.15s | Very tight (forces dead) |
| XPBD (new) | 0.20 | 1.0 | **0.69s** | Responsive |

### Calculation

```
Target: t_half ≈ 0.7s
0.7 = 0.693 / (damp × 5)
damp × 5 = 0.99
damp = 0.198 ≈ 0.20
```

---

## Why Legacy is Unaffected

### Proof 1: Grep

```bash
grep "xpbdDamping" src/physics/engine/engineTick.ts
# Result: 0 matches

grep "DEFAULT_XPBD" src/physics/engine/engineTick.ts
# Result: 0 matches
```

### Proof 2: Code Path

**Legacy mode** (`engineTick.ts:269`):
```typescript
const { effectiveDamping } = computeEnergyEnvelope(engine.lifecycle);
```

**XPBD mode** (`engineTickXPBD.ts:680`):
```typescript
const rawDamping = engine.config.xpbdDamping ?? DEFAULT_XPBD_DAMPING;
```

**Completely separate sources** - no shared code path.

---

## How to Override xpbdDamping

```typescript
// Via constructor:
const engine = new PhysicsEngine({ xpbdDamping: 0.30 });

// Via runtime update:
engine.updateConfig({ xpbdDamping: 0.30 });

// Reset to default:
engine.updateConfig({ xpbdDamping: undefined });
```

---

## Safety Clamp

xpbdDamping is clamped to `[0, 2]`:
- **0**: No damping (floaty, never settles)
- **2**: Very tight (k=10, half-life=0.07s)

Values outside this range are clamped silently.

---

## Verification Checklist (Non-UI)

### ✅ 1. Legacy Unchanged
```bash
grep -c "xpbdDamping\|DEFAULT_XPBD" src/physics/engine/engineTick.ts
# Expected: 0
```

### ✅ 2. XPBD Uses Default When Undefined
**Dev log output** (when xpbdDamping undefined):
```javascript
{
  xpbdDampingPresent: false,
  effectiveDamping: 0.20,        // ← XPBD default
  xpbdDefault: 0.20,
  legacyDamping: 0.90,           // ← Legacy unchanged
  source: 'DEFAULT_XPBD_DAMPING'
}
```

### ✅ 3. Override Works
After `engine.updateConfig({ xpbdDamping: 0.30 })`:
```javascript
{
  xpbdDampingPresent: true,
  effectiveDamping: 0.30,        // ← Override used
  xpbdDefault: 0.20,
  legacyDamping: 0.90,
  source: 'config.xpbdDamping'
}
```

---

## Files Changed

| File | Changes |
|------|---------|
| `engineTickXPBD.ts` | Added constant, changed fallback, added clamp |
| `docs/step3_*.md` | Side reports for each run |

**No changes to**:
- `engineTick.ts` (legacy)
- `config.ts` (defaults)
- `types.ts` (interface)
- `integration.ts` (receives value, doesn't read config)
- `damping.ts` (math unchanged)

---

## Commits

1. **a552449**: RUN 1 - Seam confirmation docs
2. **2854144**: RUN 2 - Add DEFAULT_XPBD_DAMPING=0.20
3. **8168cd9**: RUN 3 - Switch fallback to XPBD default
4. **9b8c9d5**: RUN 4 - Add safety clamp [0, 2]
5. **(this)**: RUN 5 - Policy doc + verification

---

## Next Steps (STEP 4/5 & 5/5)

- Consider adding `xpbdMaxVelocity` / `xpbdRepulsionStrength` if needed
- HUD work (separate task, not in this step)
- Real-world tuning with visual feedback
