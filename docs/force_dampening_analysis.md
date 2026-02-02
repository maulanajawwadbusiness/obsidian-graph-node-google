# Force Dampening Root Cause Analysis

**User Finding**: Repulsion requires `500 * 10^45` to work visibly.

## Integration Formula (CORRECT)
```typescript
// Line 151 in integration.ts
ax = effectiveFx / effectiveMass;

// Line 9 in baseIntegration.ts  
node.vx += ax * nodeDt;
```

Combined: **`velocity += (force / mass) * dt`**

This is standard physics: F = ma → a = F/m → Δv = a·Δt

## Potential Dampening Factors

### 1. Force Scaling (forcePass.ts line 241)
```typescript
node.fx *= forceScale;
```
**Question**: What is `forceScale`? If it's very small (e.g., 0.001), this would kill forces.

### 2. Mass Multiplier (integration.ts line 122)
```typescript
const effectiveMass = node.mass * (1 + massFactor * Math.max(inertiaDeg - 1, 0));
```
- `massFactor = 0.4`
- High-degree nodes get heavier (up to 5x-10x for hubs)
- **This dampens hub movement but shouldn't affect all nodes**

### 3. dt Value
- Typical: dt ≈ 0.016s (60 FPS)
- `velocity += (force / mass) * 0.016`
- **If force = 500, mass = 1, dt = 0.016 → Δv = 8 px/s**
- This seems reasonable, not absurdly small

### 4. Force Low-Pass Filter (integration.ts line 144)
```typescript
const alpha = 0.3;  // 30% previous, 70% current
effectiveFx = alpha * node.prevFx + (1 - alpha) * node.fx;
```
- Only applies to hubs (degree ≥ 3)
- Reduces force by ~30% for hubs
- **Not enough to explain 10^45 requirement**

## Hypothesis

The most likely culprit is **`forceScale`** in `forcePass.ts` line 241.

If `forceScale` is something like `0.0001` or `dt²` (0.000256), this would explain why forces need to be multiplied by 10^45 to compensate.

## Next Steps
1. Find where `forceScale` is calculated
2. Check if it's using `dt²` or some other tiny multiplier
3. Fix the scaling to be reasonable
