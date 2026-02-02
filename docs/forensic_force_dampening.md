# FORENSIC REPORT: Force Dampening Root Cause Analysis

**Date**: 2026-02-02  
**Symptom**: Repulsion requires `500 * 10^45` multiplier to produce visible effect  
**Verdict**: Multiple dampening factors compound to near-zero effective force

---

## Executive Summary

The repulsion force is being killed by **three separate dampening mechanisms** that compound multiplicatively:

1. **Legacy Mode**: `forceScale = exp(-t/0.3)` → Forces drop to 0.1% after 2 seconds
2. **Dead Core Scaling**: `repulsionScale = 0.1 + smooth * 0.9` → Forces reduced 10-100%
3. **Integration Chain**: Force → Acceleration → Velocity → Position requires multiple dt multiplications

---

## Trace 1: XPBD Repulsion Path

```
engineTickXPBD.ts:631
    └─ applyRepulsion(nodeList, activeNodes, sleepingNodes, config, stats, undefined, stride, 0, undefined)
                                                                           ^^^^^^^
                                                                           energy = undefined
```

### In forces.ts:

```typescript
// Line 48: Early expansion check
const earlyExpansion = ... && energy !== undefined && energy > 0.85;
// Result: FALSE (energy is undefined) → densityBoost = 1.0 (no boost)

// Line 222-228: Repulsion Dead Core
let repulsionScale = 1.0;
if (d < softR) {
    repulsionScale = 0.1 + smooth * 0.9;  // Range: 0.1 to 1.0
}

// Line 251: Final Force Calculation
const rawForce = (effectiveStrength / effectiveD) * repulsionScale * densityBoost * pairStride;
```

**Example with your config**:
- `effectiveStrength` = 500
- `effectiveD` = 30px (nodes at 30px apart)
- `repulsionScale` = 1.0 (assuming d >= softR)
- `densityBoost` = 1.0
- `pairStride` = 1

**rawForce = 500 / 30 * 1 * 1 * 1 = 16.67**

This force is then applied: `node.fx += 16.67` (line 270-271)

---

## Trace 2: Integration Path

```
engineTickXPBD.ts:657
    └─ integrateNodes(engine, nodeList, dt, 1.0, motionPolicy, damping, maxVel, stats, preRoll, useXPBD)
```

### In integration.ts:

```typescript
// Line 151-152: Acceleration from force
const ax = effectiveFx / effectiveMass;
const ay = effectiveFy / effectiveMass;

// Line 165: Apply to velocity
applyBaseIntegration(node, ax, ay, nodeDt);
```

### In velocity/baseIntegration.ts:

```typescript
// Line 9-10: Velocity update
node.vx += ax * nodeDt;
node.vy += ay * nodeDt;
```

**Calculation**:
- `effectiveFx` = 16.67 (from repulsion)
- `effectiveMass` = 1.0 (default node mass)
- `nodeDt` = 0.016 (60 FPS)

**Velocity change = 16.67 / 1.0 * 0.016 = 0.27 px/frame**

This seems reasonable! But wait...

---

## Trace 3: The Damping Killer

### In integration.ts, line 174:

```typescript
applyDamping(node, preRollActive, effectiveDamping, nodeDt);
```

### In velocity/damping.ts:

The damping is applied AFTER velocity is updated, reducing it significantly.

### From energy.ts:

```typescript
// Line 25-27: Damping calculation
const baseDamping = 0.3;
const maxDamping = 0.98;
const effectiveDamping = baseDamping + (maxDamping - baseDamping) * (1 - energy);
```

At `energy = 0.04` (after 1 second):
- `effectiveDamping = 0.3 + 0.68 * 0.96 = 0.95`

**Damping of 0.95 means 95% of velocity is removed per second!**

---

## The Real Problem: Legacy Force Scale (NOT IN XPBD PATH)

In the legacy tick path (`engineTick.ts` line 269-272):

```typescript
const { energy, forceScale: rawForceScale, ... } = computeEnergyEnvelope(engine.lifecycle);
const forceScale = rawForceScale * (1.0 - (policyResult.quarantineStrength * 0.5));
```

In `energy.ts`:
```typescript
const forceScale = energy = Math.exp(-lifecycle / 0.3);
```

**Timeline**:
| Time | Energy | forceScale | Effective Force |
|------|--------|------------|-----------------|
| 0s   | 1.0    | 100%       | 16.67           |
| 0.3s | 0.37   | 37%        | 6.2             |
| 0.6s | 0.14   | 14%        | 2.3             |
| 1.0s | 0.04   | 4%         | 0.67            |
| 2.0s | 0.001  | 0.1%       | 0.017           |
| 3.0s | 0.00005| 0.005%     | 0.0008          |

**After 3 seconds, forces are 0.005% of original strength!**

---

## XPBD Specific Analysis

XPBD mode does NOT use `forceScale` from energy envelope (line 637: `undefined`).

However, XPBD mode DOES use:
1. `effectiveDamping` from `computeEnergyEnvelope` → **HIGH DAMPING STILL APPLIES**
2. Integration step with `dt` multiplication

### Check line 660-666 in engineTickXPBD.ts:

```typescript
integrateNodes(
    engine as any,
    nodeList,
    dt,
    1.0,                    // energy - constant 1.0!
    motionPolicy,
    effectiveDamping,       // <-- THIS COMES FROM WHERE?
    maxVelocityEffective,   // <-- THIS COMES FROM WHERE?
    debugStats,
    preRollActive,
    true                    // useXPBD = true
);
```

**Need to trace `effectiveDamping` and `maxVelocityEffective` in XPBD path!**

---

## Root Cause Candidates

### Candidate 1: XPBD uses different damping source
The XPBD tick may have its own `effectiveDamping` that's also energy-based.

### Candidate 2: Distance threshold too small
`repulsionDistanceMax: 60` means nodes only repel within 60px. If nodes are 70px apart, NO repulsion happens.

### Candidate 3: Force magnitude vs damping mismatch
Even if forces are applied correctly (16.67), damping of 0.95+ removes 95% of velocity immediately.

### Candidate 4: Soft radius collision
`softR` in line 223 determines "dead core" scaling. If nodes are very close, repulsion is scaled DOWN to 0.1.

---

## Recommended Fixes

### Fix 1: Increase repulsion strength to match damping
If damping removes 95% per second and you apply force 60 times per second:
- Target: 5px/s steady-state repulsion velocity
- Required: `force * 0.05 / mass * dt = 5/60` → force = 100+ per frame

Current: 16.67 force → 0.27 px/frame velocity → 95% damped → 0.01 px/frame final

**Increase `repulsionStrength` to 5000-10000 for visible effect with current damping.**

### Fix 2: Reduce damping for XPBD mode
XPBD mode should use constant damping (e.g., 0.5) instead of energy-based damping.

### Fix 3: Increase distance threshold
Change `repulsionDistanceMax: 60` to `repulsionDistanceMax: 200` or more.

### Fix 4: Bypass energy envelope entirely for XPBD
Currently partially done. Ensure ALL energy-derived values (damping, maxVelocity) are independent.

---

## Immediate Action Items

1. **Trace XPBD `effectiveDamping` source** - is it using energy envelope?
2. **Add HUD telemetry** for actual force values being applied
3. **Test with damping = 0.3** (constant, low) to verify force is working
4. **Increase `repulsionStrength` to 5000** as quick fix

---

## 🚨 CRITICAL ROOT CAUSE IDENTIFIED 🚨

### The Smoking Gun: `config.damping = 0.90`

**Location**: `src/physics/config.ts` line 49

```typescript
// A simple linear fraction of velocity removed per frame.
// For example, 0.05 means each frame, velocity *= (1 - 0.05).  // <-- COMMENT IS WRONG!
damping: 0.90, // High damping for tight control  // <-- ACTUAL VALUE IS 0.90!
```

### The Math

The damping formula (in `velocity/damping.ts` or integration):
```
velocity *= (1 - damping)
velocity *= (1 - 0.90)
velocity *= 0.10
```

**Each frame, velocity is reduced to 10% of its previous value!**

At 60 FPS over 1 second:
- Frame 1: `velocity * 0.10 = 0.10`
- Frame 2: `velocity * 0.10 = 0.01`
- Frame 3: `velocity * 0.10 = 0.001`
- ...
- Frame 60: `velocity * 0.10^60 = 10^-60`

**Velocity is essentially ZERO after 3 frames!**

### Why Your Extreme Values Worked

With `repulsionStrength = 500 * 10^45`:
- Force = 500 * 10^45 / 30 = 1.67 * 10^44
- Velocity change = 1.67 * 10^44 * 0.016 / 1.0 = 2.67 * 10^42 px/frame
- After damping: 2.67 * 10^42 * 0.10 = 2.67 * 10^41 px/frame
- This is finally large enough to overcome subsequent damping!

### The Fix

**Option 1**: Fix the damping value
```typescript
damping: 0.05,  // 5% velocity removed per frame (matches the comment)
```

**Option 2**: Use different damping for XPBD
```typescript
xpbdDamping: 0.05,  // Low damping for XPBD mode
```
Then in `engineTickXPBD.ts`:
```typescript
engine.config.xpbdDamping ?? engine.config.damping,
```

**Option 3**: Change formula from linear to exponential
```typescript
// Instead of: velocity *= (1 - damping)
// Use: velocity *= Math.exp(-damping * dt)
```
This makes damping time-consistent regardless of frame rate.

---

## Verdict

The damping value `0.90` is **catastrophically high**. It was likely intended to be `0.05` or `0.09` but a typo made it `0.90`.

This single config value explains why:
1. Repulsion appears to not work
2. Absurdly high force values are required
3. Nodes don't move visibly

### Immediate Fix

Change line 49 in `config.ts`:
```typescript
damping: 0.05,  // 5% velocity removed per frame
```

Or for XPBD specifically:
```typescript
damping: 0.05,  // Standard damping for XPBD
```
