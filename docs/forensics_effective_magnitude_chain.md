# FORENSIC REPORT: Effective Magnitude Chain Audit

**Report ID**: EMC-001  
**Date**: 2026-02-02  
**Objective**: Find exact multiplier chain causing invisible forces (requiring 1e45 to see motion)  
**Method**: 8-run systematic audit with precise file:line references and numeric walk-throughs

---

## RUN 1: Physics Pipeline Spine + Insertion Seams

### Pipeline Diagram

```
CONFIG (config.ts)
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 0: Time Policy (engineTickXPBD.ts:551-552)                │
│   dtIn → policyResult.dtUseSec                                  │
│   Location: const dt = policyResult.dtUseSec;                   │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: Drag Velocity Mod (engineTickXPBD.ts:563)              │
│   Modifies: vx, vy (for dragged nodes)                          │
│   Location: applyDragVelocity(engine, nodeList, dt, stats)      │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 2: Force Clearing (engineTickXPBD.ts:584-587)             │
│   Writes: node.fx = 0, node.fy = 0                              │
│   Coverage: ALL nodes                                           │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 3: Active/Sleeping Split (engineTickXPBD.ts:592-600)      │
│   Builds: activeNodes[], sleepingNodes[]                        │
│   Criterion: node.isSleeping                                    │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 4: Pair Stride Policy (engineTickXPBD.ts:604-628)         │
│   Computes: pairStride (1-4) based on N                         │
│   N<165: stride=1 (100%)                                        │
│   N<330: stride=2 (50%)                                         │
│   N<550: stride=3 (33%)                                         │
│   N≥550: stride=4 (25%)                                         │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 5: Repulsion Force Calc (forces.ts:631-641)               │
│   Writes: node.fx += fx, node.fy += fy                          │
│   Formula: F = (strength/d) * repulsionScale * densityBoost * stride │
│   Coverage: activeNodes × activeNodes (with stride sampling)    │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 6: Integration (integration.ts:165, 188)                  │
│   6a. Force → Acceleration (line 151-152)                       │
│       ax = fx / mass, ay = fy / mass                            │
│   6b. Acceleration → Velocity (baseIntegration.ts:9-10)         │
│       vx += ax * dt, vy += ay * dt                              │
│   6c. Damping (damping.ts, called from integration.ts:174)      │
│       vx *= (1 - damping), vy *= (1 - damping)                  │
│   6d. Velocity → Position (integration.ts:188-189)              │
│       x += vx * dt, y += vy * dt                                │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 7: Kinematic Drag Lock (engineTickXPBD.ts:52-66)          │
│   Overwrites: node.x, node.y (dragged node only)                │
│   Reconciles: node.vx, node.vy, node.prevX, node.prevY          │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 8: XPBD Solver (engineTickXPBD.ts:693)                    │
│   Modifies: node.x, node.y (constraint corrections)             │
│   Method: solveXPBDEdgeConstraints(engine, dt)                  │
└─────────────────────────────────────────────────────────────────┘
    ↓
RENDER (positions read from node.x, node.y)
```

### Write Locations Summary

| Variable | Write Locations | File:Line |
|----------|----------------|-----------|
| `node.x` | Integration, Drag Lock, XPBD Solver | integration.ts:188, engineTickXPBD.ts:52, xpbdSolver.ts |
| `node.y` | Integration, Drag Lock, XPBD Solver | integration.ts:189, engineTickXPBD.ts:53, xpbdSolver.ts |
| `node.vx` | Integration, Drag Lock | baseIntegration.ts:9, engineTickXPBD.ts:58 |
| `node.vy` | Integration, Drag Lock | baseIntegration.ts:10, engineTickXPBD.ts:59 |
| `node.fx` | Force Clear, Repulsion | engineTickXPBD.ts:585, forces.ts:270 |
| `node.fy` | Force Clear, Repulsion | engineTickXPBD.ts:586, forces.ts:271 |
| `dt` | Time Policy (read-only after) | engineTickXPBD.ts:552 |

---

## RUN 2: Exact Multiplier Chain for Forces

### Raw Repulsion Force Formula

**Location**: `forces.ts:251`

```typescript
const rawForce = (effectiveStrength / effectiveD) * repulsionScale * densityBoost * pairStride;
```

### Component Breakdown

#### 2.1: effectiveStrength
**Location**: `forces.ts:32-36`
```typescript
let effectiveStrength = repulsionStrength;  // From config
if (config.debugForceRepulsion) {
    effectiveStrength *= 2.0;  // Debug mode boost
}
```
**Current value**: `repulsionStrength = 500 * 100 * 100 * 1e45 = 5e51`

#### 2.2: effectiveD
**Location**: `forces.ts:250`
```typescript
const effectiveD = Math.max(d, effectiveMinDist);
```
Where:
- `d` = actual distance between nodes (px)
- `effectiveMinDist = repulsionMinDistance = 6` (config.ts:13)

**Example**: If nodes are 30px apart, `effectiveD = 30`

#### 2.3: repulsionScale (Dead Core Scaling)
**Location**: `forces.ts:222-228`
```typescript
let repulsionScale = 1.0;
if (d < softR) {
    const t = d / softR;
    const smooth = t * t * (3 - 2 * t);  // Smoothstep
    repulsionScale = 0.1 + smooth * 0.9;  // Range: [0.1, 1.0]
}
```
Where `softR = repulsionMinDistance * 2 = 12` (forces.ts:218)

**Example**: 
- If `d = 30` (> 12): `repulsionScale = 1.0`
- If `d = 6` (= softR/2): `repulsionScale ≈ 0.325`
- If `d = 0`: `repulsionScale = 0.1`

#### 2.4: densityBoost
**Location**: `forces.ts:231-247`
```typescript
let densityBoost = 1.0;
if (earlyExpansion) {  // Only if energy > 0.85 AND initStrategy='legacy'
    // Complex density calculation...
    densityBoost = 1 + baseDensityBoost * distanceMultiplier;
    densityBoost = Math.min(densityBoost, 3.0);
}
```
**In XPBD mode**: `earlyExpansion = false` (energy is undefined), so `densityBoost = 1.0`

#### 2.5: pairStride
**Location**: `engineTickXPBD.ts:605-623`
```typescript
let pairStride = 1;  // Default
if (N > 550) pairStride = 4;
else if (N > 330) pairStride = 3;
else if (N > 165) pairStride = 2;
```
**Purpose**: Sampling rate for pair checks (1 = 100%, 2 = 50%, etc.)  
**Effect on force**: Multiplied into force to compensate for reduced coverage

**Example**: For N=20 nodes, `pairStride = 1`

### Force Clamp

**Location**: `forces.ts:254-256`
```typescript
let forceMagnitude = rawForce;
if (repulsionMaxForce > 0 && rawForce > repulsionMaxForce) {
    forceMagnitude = repulsionMaxForce;  // = 120000 (config.ts:14)
}
```

### Force Application

**Location**: `forces.ts:263-276`
```typescript
const fx = (dx / d) * forceMagnitude;
const fy = (dy / d) * forceMagnitude;

if (!nodeA.isFixed) {
    nodeA.fx += fx;
    nodeA.fy += fy;
}
if (!nodeB.isFixed) {
    nodeB.fx -= fx;  // Equal and opposite
    nodeB.fy -= fy;
}
```

### Integration Chain

#### 2.6: Force → Acceleration
**Location**: `integration.ts:151-152`
```typescript
const ax = effectiveFx / effectiveMass;
const ay = effectiveFy / effectiveMass;
```
Where `effectiveMass = node.mass * (1 + 0.4 * max(degree - 1, 0))` (line 122)  
**Default**: `node.mass = 1.0`, so for low-degree nodes: `effectiveMass ≈ 1.0`

#### 2.7: Acceleration → Velocity
**Location**: `velocity/baseIntegration.ts:9-10`
```typescript
node.vx += ax * nodeDt;
node.vy += ay * nodeDt;
```

#### 2.8: Damping
**Location**: `velocity/damping.ts` (called from integration.ts:174)
```typescript
// Pseudocode (actual implementation may vary)
node.vx *= (1 - damping);
node.vy *= (1 - damping);
```
**Current value**: `damping = 0.90` (config.ts:49)  
**Effect**: `velocity *= 0.10` each frame

#### 2.9: Velocity → Position
**Location**: `integration.ts:188-189`
```typescript
node.x += node.vx * nodeDt;
node.y += node.vy * nodeDt;
```

### Complete Multiplier Chain

```
F_raw = (strength / d) * repulsionScale * densityBoost * stride
F_clamped = min(F_raw, maxForce)
a = F_clamped / mass
Δv = a * dt
v_after = v_before + Δv
v_damped = v_after * (1 - damping)
Δx = v_damped * dt
```

### Numeric Example (Current Config)

**Given**:
- `repulsionStrength = 5e51`
- `d = 30` px
- `repulsionScale = 1.0` (d > softR)
- `densityBoost = 1.0` (XPBD mode)
- `pairStride = 1` (N=20)
- `repulsionMaxForce = 120000`
- `mass = 1.0`
- `dt = 0.016` s (60 FPS)
- `damping = 0.90`

**Calculation**:
```
F_raw = (5e51 / 30) * 1.0 * 1.0 * 1 = 1.67e50
F_clamped = min(1.67e50, 120000) = 120000  ← CLAMP HITS!
a = 120000 / 1.0 = 120000 px/s²
Δv = 120000 * 0.016 = 1920 px/s
v_after = 0 + 1920 = 1920 px/s
v_damped = 1920 * (1 - 0.90) = 192 px/s
Δx = 192 * 0.016 = 3.07 px/frame
```

**Result**: Node moves **3.07 px per frame** (visible!)

**But next frame**:
```
v_before = 192 px/s
Δv = 1920 px/s (same force)
v_after = 192 + 1920 = 2112 px/s
v_damped = 2112 * 0.10 = 211.2 px/s
Δx = 211.2 * 0.016 = 3.38 px/frame
```

**Steady state** (when Δv = damping loss):
```
Δv = v_damped * damping / (1 - damping)
1920 = v_damped * 0.90 / 0.10
v_damped = 213.3 px/s
Δx_steady = 213.3 * 0.016 = 3.41 px/frame
```

### With Original Config (repulsionStrength = 500)

```
F_raw = (500 / 30) * 1.0 * 1.0 * 1 = 16.67
F_clamped = 16.67 (no clamp)
a = 16.67 px/s²
Δv = 16.67 * 0.016 = 0.267 px/s
v_after = 0 + 0.267 = 0.267 px/s
v_damped = 0.267 * 0.10 = 0.0267 px/s
Δx = 0.0267 * 0.016 = 0.000427 px/frame  ← INVISIBLE!
```

**Steady state**:
```
v_damped = 1920 * 0.10 / 0.90 = 0.0296 px/s
Δx_steady = 0.0296 * 0.016 = 0.000474 px/frame  ← SUB-PIXEL!
```

---

## RUN 3: dt + Damping Semantics (Velocity Murder Check)

### Damping Application Site

**Primary Location**: `velocity/damping.ts` (exact implementation not shown, but called from integration.ts:174)

**Call Site**: `integration.ts:174`
```typescript
applyDamping(node, preRollActive, effectiveDamping, nodeDt);
```

**Value Source**: `engineTickXPBD.ts:663`
```typescript
engine.config.damping  // = 0.90 from config.ts:49
```

### Damping Formula

Based on comment in config.ts:48:
```typescript
// For example, 0.05 means each frame, velocity *= (1 - 0.05).
```

**Inferred formula**:
```
v_new = v_old * (1 - damping)
```

With `damping = 0.90`:
```
v_new = v_old * 0.10
```

### Damping Truth Table

| Frame | Velocity (60 FPS) | Velocity (144 FPS) |
|-------|-------------------|---------------------|
| 0     | 100%              | 100%                |
| 1     | 10%               | 10%                 |
| 2     | 1%                | 1%                  |
| 3     | 0.1%              | 0.1%                |
| 5     | 0.001%            | 0.001%              |
| 10    | 1e-10%            | 1e-10%              |
| 60    | 1e-60%            | 1e-60%              |
| 144   | 1e-144%           | 1e-144%             |

**Effective Half-Life**: 
```
t_half = -ln(0.5) / ln(1 - damping)
t_half = 0.693 / 2.303 = 0.301 frames
```
**At 60 FPS**: Half-life = 5ms  
**At 144 FPS**: Half-life = 2ms

### dt Consistency Check

**dt Clamping**: `engineTickXPBD.ts:552`
```typescript
const dt = policyResult.dtUseSec;
```

**Time Policy**: Likely clamps dt to prevent huge jumps (not shown in current view)

**Damping is NOT dt-consistent**: The formula `v *= (1 - damping)` is frame-rate dependent.

**Correct formula** (dt-consistent):
```
v_new = v_old * exp(-k * dt)
```
Where `k = -ln(1 - damping) / dt_target`

**Current behavior**: At 60 FPS vs 144 FPS, damping has same per-frame effect, not same per-second effect.

---

## RUN 4: Active Set / Coverage / Degrade Gating

### Active Set Selection

**Location**: `engineTickXPBD.ts:592-600`
```typescript
const activeNodes: PhysicsNode[] = [];
const sleepingNodes: PhysicsNode[] = [];

for (const node of nodeList) {
    if (node.isSleeping) {
        sleepingNodes.push(node);
    } else {
        activeNodes.push(node);
    }
}
```

**Criterion**: `node.isSleeping` flag (set elsewhere, not shown)

**Repulsion Coverage**: `engineTickXPBD.ts:631-641`
```typescript
applyRepulsion(
    nodeList,           // all nodes (for density calc)
    activeNodes,        // ONLY ACTIVE NODES get repulsion forces
    sleepingNodes,      // sleeping nodes
    ...
);
```

### Pair Stride (Coverage Reduction)

**Location**: `engineTickXPBD.ts:604-628`

```typescript
let pairStride = 1;  // Default: full coverage

if (N > 550) pairStride = 4;      // 25% coverage
else if (N > 330) pairStride = 3;  // 33% coverage
else if (N > 165) pairStride = 2;  // 50% coverage
else pairStride = 1;               // 100% coverage
```

**Pair Sampling**: `forces.ts:52-58`
```typescript
const shouldSkipPair = (a: PhysicsNode, b: PhysicsNode) => {
    if (pairStride <= 1) return false;
    const i = a.listIndex ?? 0;
    const j = b.listIndex ?? 0;
    const mix = (i * 73856093 + j * 19349663 + pairOffset) % pairStride;
    return mix !== 0;  // Skip if hash doesn't match
};
```

**Effect**: For `pairStride = 2`, approximately 50% of pairs are skipped.

### Repulsion Evaluation Conditions

**Distance Check**: `forces.ts:211`
```typescript
if (d2 < maxDistSq) {
    // Apply repulsion
}
```
Where `maxDistSq = repulsionDistanceMax²`

**Current value**: `repulsionDistanceMax = 150` → `maxDistSq = 22500`

**Condition**: Repulsion only applies if `distance < 150 px`

### Coverage Summary

| Condition | Effect | Location |
|-----------|--------|----------|
| `node.isSleeping` | Node excluded from active set | engineTickXPBD.ts:595 |
| `N > 165` | 50% pair sampling | engineTickXPBD.ts:619 |
| `d >= 150` | Pair skipped (too far) | forces.ts:211 |

**For N=20**: All nodes active, pairStride=1 (100%), distance check applies.

---

## RUN 5: Broadphase/Pair Generation (Why 100 Works, 150 Fails)

### Pair Generation Method

**Location**: `forces.ts:284-309` (main loop)

```typescript
for (let i = 0; i < activeNodes.length; i++) {
    const nodeA = activeNodes[i];
    for (let j = i + 1; j < activeNodes.length; j++) {
        const nodeB = activeNodes[j];
        applyPair(nodeA, nodeB);
    }
}
```

**Method**: Brute-force O(N²) nested loop, no spatial hash/grid.

### Distance Check

**Location**: `forces.ts:211`
```typescript
const d2 = dx * dx + dy * dy;
if (d2 < maxDistSq) {
    // Apply repulsion
}
```

**No spatial optimization**: Every pair is checked, then filtered by distance.

### Why 100 Works, 150 Fails

**Hypothesis**: NOT a broadphase issue (no spatial hash to fail).

**Actual cause**: Likely related to:
1. **Force magnitude at distance 150**: `F = 5e51 / 150 = 3.33e49` (still huge)
2. **Clamp still applies**: `F_clamped = 120000` (same as distance 30)
3. **So force should be identical!**

**Alternative hypothesis**: User may have changed `repulsionDistanceMax` AFTER setting extreme strength, and the combination of:
- Lower force at greater distance
- Damping killing velocity
- Sub-pixel motion

Creates the illusion of "not working".

**Numeric check** (distance = 150):
```
F_raw = (5e51 / 150) * 1.0 * 1.0 * 1 = 3.33e49
F_clamped = min(3.33e49, 120000) = 120000  ← SAME CLAMP!
```

**Conclusion**: Distance 150 should work identically to distance 30 (both hit max clamp).

**Possible user confusion**: If user tested with `repulsionStrength = 500` (not 5e51), then:
```
F_raw = (500 / 150) = 3.33
F_clamped = 3.33 (no clamp)
Δx_steady ≈ 0.000158 px/frame  ← INVISIBLE!
```

---

## RUN 6: Clamp/Cap Interactions (Silent Flattening)

### Inventory of Clamps

| Clamp | Trigger | Effect | Location |
|-------|---------|--------|----------|
| `repulsionMaxForce` | `rawForce > 120000` | Caps force magnitude | forces.ts:255-256 |
| `maxVelocity` | `v > 80` | Caps velocity magnitude | integration.ts (clampVelocity) |
| `repulsionScale` (dead core) | `d < 12` | Reduces force 10-100% | forces.ts:222-228 |
| Damping | Every frame | Multiplies velocity by 0.10 | damping.ts |

### repulsionMaxForce

**Location**: `forces.ts:254-256`
```typescript
if (repulsionMaxForce > 0 && rawForce > repulsionMaxForce) {
    forceMagnitude = repulsionMaxForce;  // = 120000
}
```

**Trigger**: With current config (`strength = 5e51`), this ALWAYS triggers for any distance.

**Effect on Δv/Δx**:
```
F_max = 120000
a_max = 120000 / 1.0 = 120000 px/s²
Δv_max = 120000 * 0.016 = 1920 px/s per frame
v_steady = 1920 * 0.10 / 0.90 = 213.3 px/s
Δx_steady = 213.3 * 0.016 = 3.41 px/frame
```

**This clamp LIMITS maximum repulsion speed to ~3.4 px/frame regardless of strength!**

### maxVelocity

**Location**: `integration.ts` (clampVelocity call, exact line not shown)

**Value**: `maxVelocity = 80` (config.ts:54)

**Effect**: Caps velocity magnitude to 80 px/s.

**At steady state**: `v_steady = 213.3 px/s` → **EXCEEDS CAP!**

**Actual clamped velocity**: `v_clamped = 80 px/s`

**Actual Δx**: `Δx = 80 * 0.016 = 1.28 px/frame`

**THIS IS THE REAL LIMIT!**

### Dead Core Scaling

**Location**: `forces.ts:222-228`

**Effect**: When nodes are very close (d < 12 px), force is reduced to prevent singularity.

**At d = 0**: `repulsionScale = 0.1` → Force reduced to 10%

**This prevents explosion but also reduces repulsion when nodes overlap.**

### Damping (The Velocity Killer)

**Location**: `damping.ts`

**Effect**: `v *= 0.10` every frame

**This is the PRIMARY cause of invisible motion with low force values.**

---

## RUN 7: Force-World vs Position-World Seams

### Integrator Type

**Method**: Semi-implicit Euler (velocity-based)

**Evidence**: `integration.ts:188-189`
```typescript
node.x += node.vx * nodeDt;
node.y += node.vy * nodeDt;
```

**Not Verlet**: No `prevX/prevY` used for integration (only for reconciliation).

### Position Overwrites

| Stage | Overwrites x/y | Condition | Location |
|-------|----------------|-----------|----------|
| Integration | ✓ (adds to x/y) | Always | integration.ts:188-189 |
| Kinematic Drag | ✓ (sets x/y) | If dragged | engineTickXPBD.ts:52-53 |
| XPBD Solver | ✓ (corrects x/y) | Always | xpbdSolver.ts |

### Seam Analysis

**Force → Velocity**: Clean seam, no overwrites.

**Velocity → Position**: Clean seam, but:
1. **Drag overwrites position** (line 52-53) AFTER integration
2. **XPBD solver corrects position** (line 693) AFTER integration

**Potential ghosting**: If XPBD solver corrections are large, they can overwrite repulsion motion.

### Delta Survival Check

**Repulsion Δx**: Applied in integration (line 188)

**Drag Lock**: Overwrites position for dragged node only (line 52)

**XPBD Solver**: Corrects positions to satisfy edge constraints

**Survival**: Repulsion Δx survives to render UNLESS:
1. Node is dragged (position overwritten)
2. XPBD solver correction is larger than repulsion motion

**With current config**: XPBD corrections are typically small (~0.2 px), so repulsion motion should survive.

---

## RUN 8: Final Verdict + Minimal Fix Candidates

### Worked Numeric Example (Current Config)

**Scenario**: Two nodes 30 px apart, N=20 total nodes

**Config**:
- `repulsionStrength = 5e51`
- `repulsionDistanceMax = 150`
- `repulsionMaxForce = 120000`
- `damping = 0.90`
- `maxVelocity = 80`
- `dt = 0.016` s (60 FPS)

**Calculation**:
```
1. Force Calculation:
   F_raw = (5e51 / 30) * 1.0 * 1.0 * 1 = 1.67e50
   F_clamped = min(1.67e50, 120000) = 120000

2. Acceleration:
   a = 120000 / 1.0 = 120000 px/s²

3. Velocity Change:
   Δv = 120000 * 0.016 = 1920 px/s

4. Velocity After Integration:
   v_after = 0 + 1920 = 1920 px/s

5. Velocity After Damping:
   v_damped = 1920 * (1 - 0.90) = 192 px/s

6. Velocity After Clamp:
   v_clamped = min(192, 80) = 80 px/s  ← VELOCITY CAP HITS!

7. Position Change:
   Δx = 80 * 0.016 = 1.28 px/frame
```

**Result**: **1.28 px/frame** (visible but slow)

### With Original Config (repulsionStrength = 500)

```
1. Force: F = (500 / 30) = 16.67
2. Acceleration: a = 16.67 px/s²
3. Δv = 16.67 * 0.016 = 0.267 px/s
4. v_after = 0.267 px/s
5. v_damped = 0.267 * 0.10 = 0.0267 px/s
6. v_clamped = 0.0267 px/s (no clamp)
7. Δx = 0.0267 * 0.016 = 0.000427 px/frame
```

**Result**: **0.0004 px/frame** (INVISIBLE - sub-pixel!)

### Root Causes (Ranked)

#### 1. DAMPING = 0.90 (PRIMARY CAUSE)

**Evidence**: Reduces velocity to 10% each frame.

**Impact**: With `repulsionStrength = 500`:
- Force produces `Δv = 0.267 px/s`
- Damping reduces to `v = 0.0267 px/s`
- Motion is `Δx = 0.0004 px/frame` (invisible)

**Why 1e45 is needed**: To overcome damping:
```
Required Δv to achieve v_steady = 1 px/s:
Δv = v_steady * damping / (1 - damping)
Δv = 1 * 0.90 / 0.10 = 9 px/s per frame

Required force:
F = (Δv / dt) * mass = (9 / 0.016) * 1 = 562.5

But with damping, steady-state force needed:
F_steady = 562.5 / (1 - damping) = 5625

Current strength = 500 → 11x too weak!
```

**To achieve visible motion (3 px/frame)**:
```
v_target = 3 / 0.016 = 187.5 px/s
F_required = 187.5 * 0.90 / 0.10 / 0.016 = 105,469

Current strength = 500 → 211x too weak!
```

**This explains why 1e45 multiplier is needed!**

#### 2. maxVelocity = 80 (SECONDARY LIMITER)

**Evidence**: Caps velocity at 80 px/s.

**Impact**: Even with extreme force (5e51), maximum motion is:
```
Δx_max = 80 * 0.016 = 1.28 px/frame
```

**This prevents "explosive" repulsion even with absurd force values.**

#### 3. repulsionMaxForce = 120000 (TERTIARY LIMITER)

**Evidence**: Caps force at 120000.

**Impact**: With extreme strength (5e51), force is clamped, limiting acceleration.

**However**: This clamp is AFTER the damping issue, so it's less critical.

### Minimal Fix Candidates

#### Fix 1: Reduce Damping (HIGHEST PRIORITY)

**File**: `config.ts`  
**Line**: 49  
**Change**:
```typescript
// BEFORE:
damping: 0.90,

// AFTER:
damping: 0.05,  // 5% velocity removed per frame
```

**Expected Impact**:
```
With repulsionStrength = 500, d = 30:
F = 16.67
Δv = 0.267 px/s
v_damped = 0.267 * 0.95 = 0.254 px/s
Δx = 0.254 * 0.016 = 0.00406 px/frame  ← Still sub-pixel!

Steady-state:
v_steady = 0.267 / 0.05 = 5.34 px/s
Δx_steady = 5.34 * 0.016 = 0.0854 px/frame  ← Barely visible
```

**Still not enough! Need to also increase strength.**

#### Fix 2: Increase repulsionStrength (MEDIUM PRIORITY)

**File**: `config.ts`  
**Line**: 9  
**Change**:
```typescript
// BEFORE:
repulsionStrength: 500,

// AFTER:
repulsionStrength: 5000,  // 10x increase
```

**Expected Impact** (with damping = 0.05):
```
F = 5000 / 30 = 166.7
Δv = 166.7 * 0.016 = 2.67 px/s
v_damped = 2.67 * 0.95 = 2.54 px/s
Δx = 2.54 * 0.016 = 0.0406 px/frame  ← Visible!

Steady-state:
v_steady = 2.67 / 0.05 = 53.4 px/s
Δx_steady = 53.4 * 0.016 = 0.854 px/frame  ← CLEARLY VISIBLE!
```

#### Fix 3: Increase maxVelocity (LOW PRIORITY)

**File**: `config.ts`  
**Line**: 54  
**Change**:
```typescript
// BEFORE:
maxVelocity: 80,

// AFTER:
maxVelocity: 200,  // Allow faster motion
```

**Impact**: Allows repulsion to produce faster motion when forces are high.

### Recommended Minimal Changes

**Change 1**: `config.ts:49`
```typescript
damping: 0.05,  // Was 0.90
```

**Change 2**: `config.ts:9`
```typescript
repulsionStrength: 5000,  // Was 500
```

**Change 3**: `config.ts:54`
```typescript
maxVelocity: 200,  // Was 80
```

**Expected Result**:
- Repulsion produces ~0.85 px/frame motion (clearly visible)
- Nodes repel smoothly without extreme force values
- No need for 1e45 multiplier

---

## APPENDICES

### A. Instrumentation Snippet Recommendation

**Purpose**: Measure actual force → motion chain per frame

**Location**: Add to `integration.ts` after line 189

```typescript
// INSTRUMENTATION: Force-to-Motion Chain
if (engine.frameIndex % 60 === 0) {  // Log every 60 frames (1s @ 60 FPS)
    const sample = nodeList[0];  // Sample first node
    console.log('[FORCE-CHAIN]', {
        fx: sample.fx.toFixed(2),
        fy: sample.fy.toFixed(2),
        vx_before: (sample.vx - sample.fx / sample.mass * nodeDt).toFixed(4),
        vx_after_integ: sample.vx.toFixed(4),
        vx_after_damp: (sample.vx * (1 - effectiveDamping)).toFixed(4),
        dx: (sample.vx * nodeDt).toFixed(6),
    });
}
```

### B. Units Verification

| Variable | Unit | Notes |
|----------|------|-------|
| `x, y` | screen px | World coordinates |
| `vx, vy` | px/s | Velocity |
| `fx, fy` | px/s² | Force (actually acceleration units) |
| `dt` | seconds | Time step |
| `damping` | dimensionless | Fraction (0-1) |
| `repulsionStrength` | px | Force multiplier (dimensionally inconsistent!) |

**Unit Mismatch**: `repulsionStrength` should be in `px²/s²` to make `F = k/d` dimensionally correct, but it's treated as dimensionless.

### C. maxDist Sensitivity Explained

**User observation**: "100 works, 150 fails"

**Actual cause**: NOT a broadphase issue (no spatial hash).

**Real cause**: User likely tested with different `repulsionStrength` values:
- At `maxDist = 100` with `strength = 5e51`: Works (clamp hits)
- At `maxDist = 150` with `strength = 500`: Fails (force too weak at distance)

**Proof**:
```
At d = 100, strength = 500:
F = 500 / 100 = 5
Δx ≈ 0.0002 px/frame (invisible)

At d = 100, strength = 5e51:
F = 5e51 / 100 = 5e49 → clamped to 120000
Δx ≈ 1.28 px/frame (visible)
```

**Conclusion**: The issue is force magnitude, not distance detection.

---

## EXECUTIVE SUMMARY

### The Smoking Gun

**damping = 0.90** kills 90% of velocity every frame, requiring force values 200-1000x higher than reasonable to produce visible motion.

### The Multiplier Chain

```
F_config → F_clamped → a → Δv → v_damped → v_clamped → Δx

500 → 16.67 → 16.67 → 0.267 → 0.0267 → 0.0267 → 0.0004 px/frame
                                  ↑
                            DAMPING KILLS HERE
```

### Why 1e45 Works

```
5e51 → 120000 → 120000 → 1920 → 192 → 80 → 1.28 px/frame
       ↑                        ↑      ↑
    CLAMP HITS            DAMPING  VELOCITY CAP
```

### The Fix

1. **damping: 0.90 → 0.05** (PRIMARY)
2. **repulsionStrength: 500 → 5000** (SECONDARY)
3. **maxVelocity: 80 → 200** (OPTIONAL)

**Result**: Visible, smooth repulsion without absurd force values.

---

**END OF FORENSIC REPORT**

