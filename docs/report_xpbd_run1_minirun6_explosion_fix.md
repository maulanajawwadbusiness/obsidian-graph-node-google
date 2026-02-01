# XPBD Mini Run 6: Explosion Bug Fix - Root Cause Analysis

## The Bug

**Symptom**: After clicking and releasing a node, instant explosion of the entire node map.

**Introduced in**: Commit transition from Part 2 → Part 3 (config fields → replace hardcoded compliance)

## Root Cause

### The Physics Mistake

I had the XPBD compliance physics **completely backwards**:

```
XPBD Formula: alpha = compliance / dt²
              deltaLambda = (-C - alpha * lambda) / (wSum + alpha)
```

**WRONG Understanding** (what I thought):
- Small compliance (0.0001) → Small alpha → Weak corrections → Invisible
- Large compliance (0.1) → Large alpha → Strong corrections → Visible

**CORRECT Understanding**:
- **Small compliance (0.0001)** → Small alpha (0.39) → **STIFF constraint** → deltaLambda ≈ -C/wSum → **LARGE corrections** → **EXPLOSION**
- **Large compliance (0.01)** → Large alpha (39) → **SOFT constraint** → deltaLambda ≈ -C/alpha → **SMALL corrections** → **STABLE**

### The Math

For a 10px error with wSum=2:

**With compliance = 0.0001 (TOO STIFF)**:
```
alpha = 0.0001 / (0.016)² ≈ 0.39
deltaLambda ≈ -10 / (2 + 0.39) ≈ -4.18
correction per node ≈ 4.18 / 2 ≈ 2.09 px
```
This seems reasonable, BUT when you **drag and release**, the error can be 100px+, causing:
```
deltaLambda ≈ -100 / 2.39 ≈ -41.8
correction per node ≈ 20.9 px PER CONSTRAINT
```
With multiple constraints per node → **EXPLOSION**

**With compliance = 0.01 (STABLE)**:
```
alpha = 0.01 / (0.016)² ≈ 39
deltaLambda ≈ -10 / (2 + 39) ≈ -0.24
correction per node ≈ 0.12 px
```
Even with 100px error:
```
deltaLambda ≈ -100 / 41 ≈ -2.44
correction per node ≈ 1.22 px
```
**STABLE** and still visible!

## The Fix

### Changed Values

| File | Line | Old Value | New Value |
|------|------|-----------|-----------|
| `engineTickXPBD.ts` | 101 | `0.0001` | `0.01` |
| `config.ts` | 179 | `0.0001` | `0.01` |

### Calibration Table (CORRECTED)

| Compliance | Alpha @ 60Hz | Behavior | Result |
|------------|--------------|----------|--------|
| 0.0001 | ~0.39 | TOO STIFF | ❌ EXPLOSION on drag release |
| 0.001 | ~3.9 | Stiff | ⚠️ Risky, large corrections |
| **0.01** | **~39** | **Moderate** | ✅ **Visible, stable** |
| 0.1 | ~390 | Very soft | ⚠️ Barely visible |
| 1.0 | ~3900 | Extremely soft | ❌ Invisible |

## Lessons Learned

1. **XPBD compliance is counter-intuitive**: Smaller values = stiffer = MORE correction, not less
2. **Always test drag-release**: Static scenes hide instability that appears under large perturbations
3. **Fine-grained commits save lives**: The 10-commit strategy let us bisect to the exact line
4. **Document the physics**: The comment now explains the backwards relationship clearly

## Verification

After fix:
- ✅ Drag and release: No explosion
- ✅ Corrections visible: ~0.2px per frame
- ✅ Stable settling: Constraints converge smoothly
- ✅ HUD shows: `C: 0.010000 | α: 39.00`

## Files Modified

1. `src/physics/engine/engineTickXPBD.ts` - Added physics explanation, changed default
2. `src/physics/config.ts` - Updated default compliance value
3. `docs/report_xpbd_run1_minirun6_explosion_fix.md` - This report

---

**Status**: ✅ FIXED
**Commit**: "fix(xpbd): correct compliance value - 0.0001 was too stiff, caused explosion on drag release"
