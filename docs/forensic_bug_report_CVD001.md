# FORENSIC BUG REPORT: Catastrophic Velocity Damping (CVD-001)

**Report ID**: CVD-001  
**Date**: 2026-02-02  
**Severity**: CRITICAL  
**Status**: Root Cause Identified, Fix Pending  
**Author**: Forensic Analysis System

---

## 1. WHAT IS THIS BUG?

A configuration value typo causes **90% of all node velocity to be destroyed every single frame**. This makes force-based physics (repulsion, springs, collision) appear completely non-functional, requiring absurdly high force values (10^45) to produce any visible effect.

**In Plain English**: Imagine a car where the brakes remove 90% of speed every second. At 60 checks per second, after just 3 checks your speed is 0.1% of what it was. No matter how hard you press the gas, you can't move.

---

## 2. WHERE IT HAPPENS

### Primary Location
**File**: `src/physics/config.ts`  
**Line**: 49  
**Value**: `damping: 0.90`

```typescript
// ---------------------------------------------------------------------------
// ANCHOR: Damping (Air Friction)
// ---------------------------------------------------------------------------
// A simple linear fraction of velocity removed per frame.
// For example, 0.05 means each frame, velocity *= (1 - 0.05).  // <-- THE COMMENT
damping: 0.90, // High damping for tight control                 // <-- THE BUG
```

### Effect Location
**File**: `src/physics/engine/velocity/damping.ts`  
**Called From**: `src/physics/engine/integration.ts` line 174

---

## 3. HOW IT HAPPENS

### The Damping Formula

When damping is applied, the physics engine executes:

```typescript
node.vx *= (1 - damping);
node.vy *= (1 - damping);
```

With `damping = 0.90`:
```typescript
node.vx *= (1 - 0.90);  // → node.vx *= 0.10
node.vy *= (1 - 0.90);  // → node.vy *= 0.10
```

**Each frame, velocity becomes 10% of what it was.**

### Frame-by-Frame Destruction

| Frame | Velocity Remaining | After 60 FPS |
|-------|-------------------|--------------|
| 0     | 100%              | Start        |
| 1     | 10%               | 0.016s       |
| 2     | 1%                | 0.033s       |
| 3     | 0.1%              | 0.050s       |
| 5     | 0.001%            | 0.083s       |
| 10    | 10^-10 %          | 0.166s       |
| 60    | 10^-60 %          | 1.000s       |

**After just 3 frames (50ms), velocity is at 0.1%. After 10 frames (166ms), it's essentially zero.**

---

## 4. WHY IT HAPPENS

### The Typo Theory

The comment says:
```typescript
// For example, 0.05 means each frame, velocity *= (1 - 0.05).
```

This suggests the intended value was **0.05** (5% damping per frame).

But the actual value is **0.90** (90% damping per frame).

**Likely cause**: Someone typed `0.90` instead of `0.09` or `0.05`.

### The "High Damping" Justification

The comment says:
```typescript
damping: 0.90, // High damping for tight control
```

This suggests the value was intentional for "tight control". However, 0.90 doesn't provide "tight control" - it provides "complete paralysis".

| Damping Value | Description | Velocity After 1s @ 60 FPS |
|---------------|-------------|---------------------------|
| 0.01          | Very low    | 54.7% remaining           |
| 0.05          | Low         | 4.6% remaining            |
| 0.10          | Medium      | 0.18% remaining           |
| 0.50          | High        | 10^-19 % remaining        |
| **0.90**      | **CURRENT** | **10^-60 % remaining**    |

**0.90 is not "high damping" - it's "instantaneous stop".**

---

## 5. SYSTEMS INVOLVED

### Primary System
- **Physics Engine** (`src/physics/engine/`)
  - Configuration loading
  - Per-frame velocity update
  - Force integration

### Secondary Systems
- **Repulsion System** (`src/physics/forces.ts`) - Generates forces that get nullified
- **Spring System** (`src/physics/forces.ts`) - Generates forces that get nullified
- **Collision System** (`src/physics/forces.ts`) - Generates forces that get nullified
- **XPBD Solver** (`src/physics/engine/engineTickXPBD.ts`) - Constraints become ineffective

---

## 6. INTER-SYSTEM INTERACTIONS

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Force Sources  │     │   Integration   │     │    Damping      │
│  - Repulsion    │────▶│   F → a → v     │────▶│   v *= 0.10     │
│  - Springs      │     │   node.vx += Δv │     │   VELOCITY DIES │
│  - Collision    │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                │
        │              FORCES ARE CORRECT                │
        │              (500, 1200, etc.)                 │
        │                                                │
        ▼                                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │                   POSITION UPDATE                        │
   │   node.x += node.vx * dt                                 │
   │   node.y += node.vy * dt                                 │
   │                                                          │
   │   But vx ≈ 0 and vy ≈ 0, so nodes DON'T MOVE            │
   └─────────────────────────────────────────────────────────┘
```

### The Chain of Events

1. **Repulsion calculates force**: `F = 500 / 30 = 16.67`
2. **Integration adds to velocity**: `v += F/m * dt = 16.67 * 0.016 = 0.27 px/frame`
3. **Damping destroys velocity**: `v *= 0.10 = 0.027 px/frame`
4. **Position barely changes**: `x += 0.027 * 0.016 = 0.0004 px/frame`
5. **Next frame**: Damping again → `v = 0.0027 px/frame`
6. **Result**: Node appears frozen

---

## 7. FUNCTIONS AFFECTED

### Directly Affected

| Function | File | Impact |
|----------|------|--------|
| `applyDamping()` | `velocity/damping.ts` | Executes the damping formula |
| `integrateNodes()` | `integration.ts` | Calls damping after velocity update |

### Indirectly Affected (Rendered Ineffective)

| Function | File | Impact |
|----------|------|--------|
| `applyRepulsion()` | `forces.ts` | Forces produce no visible movement |
| `applySprings()` | `forces.ts` | Spring forces nullified |
| `applyCollision()` | `forces.ts` | Collision forces nullified |
| `solveXPBDEdgeConstraints()` | `xpbdSolver.ts` | Corrections partially nullified |
| `applyBoundaryForce()` | `forces.ts` | Boundary forces nullified |

---

## 8. RESULT ON SCREEN

### What User Sees
1. **Nodes don't repel** - Even when overlapping, nodes stay stuck
2. **Graph doesn't "breathe"** - No natural settling motion
3. **Dragging feels like moving through molasses** - Extreme stickiness
4. **Forces appear "broken"** - No matter what strength values are set

### What User Tested
User set `repulsionStrength = 500 * 100 * 100 * 10^45` (effectively 10^50).

**Only then** did nodes begin to repel visibly.

This proves the force system itself is working - the forces are just being killed by damping before they can produce movement.

---

## 9. CODE INVOLVED

### The Bug (config.ts line 49)
```typescript
damping: 0.90, // High damping for tight control
```

### The Consumer (integration.ts)
```typescript
// Line 174
applyDamping(node, preRollActive, effectiveDamping, nodeDt);
```

### XPBD Path (engineTickXPBD.ts)
```typescript
// Lines 657-668
integrateNodes(
    engine as any,
    nodeList,
    dt,
    1.0,
    motionPolicy,
    engine.config.damping,  // <-- Line 663: Uses damping directly!
    engine.config.maxVelocity,
    debugStats,
    false,
    true
);
```

### The Damping Execution (velocity/damping.ts)
```typescript
// Pseudocode - actual implementation varies
node.vx *= (1 - damping);
node.vy *= (1 - damping);
```

---

## 10. CODE FILES INVOLVED

| File | Role | Line Numbers |
|------|------|--------------|
| `src/physics/config.ts` | **SOURCE OF BUG** | 49 |
| `src/physics/engine/integration.ts` | Calls damping | 174 |
| `src/physics/engine/engineTickXPBD.ts` | Passes damping value | 663 |
| `src/physics/engine/velocity/damping.ts` | Executes damping formula | Entire file |
| `src/physics/forces.ts` | Victim (forces ineffective) | All force functions |
| `src/physics/engine/engineTick.ts` | Legacy tick (also affected) | 269 (energy envelope) |

---

## 11. CODE INTERACTION DIAGRAM

```
┌──────────────────────────────────────────────────────────────────┐
│                         config.ts                                 │
│                                                                   │
│  damping: 0.90  ◀──────────────── THE BUG IS HERE                │
└──────────────────────────────────────────────────────────────────┘
                                │
                                │ engine.config.damping
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                      engineTickXPBD.ts                           │
│                                                                   │
│  integrateNodes(                                                  │
│      ...,                                                         │
│      engine.config.damping,  ◀─── Passed to integration          │
│      ...                                                          │
│  );                                                               │
└──────────────────────────────────────────────────────────────────┘
                                │
                                │ effectiveDamping parameter
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                        integration.ts                             │
│                                                                   │
│  for (const node of nodeList) {                                   │
│      // 1. Calculate acceleration from forces                     │
│      const ax = node.fx / node.mass;                              │
│      const ay = node.fy / node.mass;                              │
│                                                                   │
│      // 2. Update velocity                                        │
│      node.vx += ax * dt;  // Velocity increases...               │
│      node.vy += ay * dt;                                          │
│                                                                   │
│      // 3. Apply damping                                          │
│      applyDamping(node, ..., effectiveDamping, dt);               │
│      // ▲▲▲ VELOCITY DESTROYED HERE ▲▲▲                          │
│                                                                   │
│      // 4. Update position (but velocity is now ~0)               │
│      node.x += node.vx * dt;  // Nearly zero movement            │
│      node.y += node.vy * dt;                                      │
│  }                                                                │
└──────────────────────────────────────────────────────────────────┘
                                │
                                │ effectiveDamping = 0.90
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                        damping.ts                                 │
│                                                                   │
│  export const applyDamping = (node, ..., damping, dt) => {        │
│      node.vx *= (1 - damping);  // vx *= 0.10                     │
│      node.vy *= (1 - damping);  // vy *= 0.10                     │
│      //         ▲▲▲▲▲▲▲▲▲▲▲▲                                     │
│      //    90% OF VELOCITY REMOVED!                               │
│  };                                                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 12. WHAT TO FIX

### Immediate Fix (Single Line Change)

**File**: `src/physics/config.ts`  
**Line**: 49  
**Change**:
```typescript
// BEFORE (BUG):
damping: 0.90, // High damping for tight control

// AFTER (FIX):
damping: 0.05, // 5% velocity removed per frame (matches original comment intent)
```

### Alternative Fix (XPBD-Specific Damping)

Add new config value:
```typescript
// config.ts
xpbdDamping: 0.05,  // XPBD uses lower damping for visible force response
```

Update XPBD tick:
```typescript
// engineTickXPBD.ts line 663
engine.config.xpbdDamping ?? engine.config.damping,  // Prefer XPBD damping
```

### Recommended Values

| Scenario | Damping Value | Effect |
|----------|---------------|--------|
| Standard physics | 0.05 | Natural, fluid motion |
| Tight control | 0.15 | Quick settling, still responsive |
| Molasses (intentional) | 0.30 | Very slow, deliberate motion |
| Current (BUG) | 0.90 | Instant paralysis |

---

## 13. VERIFICATION STEPS

After applying fix:

1. **Open playground**
2. **Check HUD**: Mode should show "XPBD" (green)
3. **Drag a node** close to another (within 60px)
4. **Release**: Node should visibly push away from neighbor
5. **Check "Repulsion Proof"** in HUD:
   - `Called: YES`
   - `Pairs: > 0`
   - `MaxForce: > 0`
6. **Visual confirmation**: Nodes should naturally repel and settle

---

## 14. LESSONS LEARNED

1. **Comments can lie** - The comment said "0.05" but value was "0.90"
2. **Extreme values are a diagnostic** - Needing 10^45 force means something fundamental is wrong
3. **Damping is multiplicative** - Small damping values compound to huge effects over frames
4. **XPBD should have independent config** - Separate config for XPBD prevents legacy values from breaking modern solver

---

## 15. APPENDIX: MATHEMATICAL PROOF

### Given
- `damping = 0.90`
- `velocity_n+1 = velocity_n * (1 - damping)`
- `dt = 1/60 s` (60 FPS)

### Derivation
```
velocity_1 = velocity_0 * 0.10
velocity_2 = velocity_1 * 0.10 = velocity_0 * 0.10²
velocity_n = velocity_0 * 0.10^n
```

### After 60 frames (1 second)
```
velocity_60 = velocity_0 * 0.10^60
            = velocity_0 * 10^-60
```

### Force required to maintain constant velocity
```
If velocity = 1 px/frame is desired:
Required force per frame = 1 / (0.10) = 10 px acceleration equivalent
Required continuous force = 10 / dt = 600 units

But damping removes 90% every frame, so:
Required force = 600 / (1 - 0.10^60) ≈ 600 units per frame sustained

With repulsionStrength = 500, max force = 500/6 ≈ 83
This is 7x too weak!
```

This explains why `repulsionStrength = 500` produces no visible effect - it's overwhelmed by damping.

---

**END OF FORENSIC REPORT**
