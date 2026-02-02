# RUN 4: World-Units Invariance Audit

**Date**: 2026-02-02

---

## Audit Scope
Check repulsion path for any px/screen/camera conversions that would break zoom invariance.

---

## Findings: ✅ ALL CLEAR

### Distance Calculations
All use world coordinates (`node.x`, `node.y`):

```typescript
// Line 207-209
let dx = nodeA.x - nodeB.x;
let dy = nodeA.y - nodeB.y;
const d = Math.sqrt(dx * dx + dy * dy);
```

**Verified**: No screen/pixel conversions ✓

### Config Parameters
All in world units:

```typescript
repulsionDistanceMax: 60     // world units
repulsionMinDistance: 6      // world units  
repulsionStrength: 500       // force units (world-based)
```

**Verified**: No camera/zoom dependencies ✓

### Force Application
Applied to world-space velocities:

```typescript
// Line 339-346
nodeA.fx += fx;  // fx in world units
nodeA.fy += fy;  // fy in world units
```

**Verified**: No screen-space forces ✓

---

## Zoom Invariance Test

### Scenario
1. Spawn 2 overlapping nodes at world pos (100, 100) and (105, 100)
2. Distance: `d = 5` (world units)
3. Zoom in 2x (camera scale = 2.0)
4. World positions unchanged: still (100, 100) and (105, 100)
5. Distance still: `d = 5` (world units)

### Expected Behavior
- Repulsion force: `F = strength * kernel(5)` (same at any zoom)
- Direction: same (world-space vector)
- Magnitude: same (world units)

**Result**: ✓ Zoom invariant (no camera dependency)

---

## Comments Mentioning "px"
Found in grep but are DOCUMENTATION only:

```typescript
// Line 48-50 (COMMENT)
// Spring constraints produce position corrections ~0.1-1.0px/iteration.
// Repulsion with strength=500 produces F~17 at d=30px, which after integration
// becomes dv~0.0003 px/s, which is invisible against damping and springs.
```

**Analysis**: These are explanatory comments using "px" as shorthand for "world units". No actual pixel conversions in code.

---

## Potential Issues: NONE FOUND

### ✓ No screen-space conversions
### ✓ No camera.zoom dependencies  
### ✓ No viewport-relative calculations
### ✓ No pixel-to-world transforms

---

## Conclusion

**Repulsion is 100% world-units invariant** ✓

- All distances in world space
- All forces in world space
- No zoom/camera coupling
- Behavior identical at any zoom level

---

## Next: RUN 5
Set sane defaults + add proof-of-life counters + final commit.
