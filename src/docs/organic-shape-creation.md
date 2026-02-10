# How the Organic Graph Shape is Created

This document explains in comprehensive detail how the asymmetric, organic node cloud shape emerges from the physics simulation.

---

## 1. Initial Topology Generation (Structural DNA)

### Spine-Rib-Fiber Architecture

The graph uses a hierarchical topology with three node types:

```typescript
Spine nodes (3-5):     Heavy (mass: 4.0), Large (radius: 8.0)
Rib nodes (60-75%):    Medium (mass: 2.0), Medium (radius: 6.0)  
Fiber nodes (remainder): Light (mass: 1.0), Small (radius: 4.0)
```

### Asymmetric Initial Placement (Breaking Symmetry)

**Spine - Diagonal "Crooked" Axis:**
```typescript
spineStep = { 
    x: targetSpacing * initScale,      // 375 * 0.1 = 37.5px
    y: targetSpacing * initScale * 0.5  // 18.75px
}
// Creates 2:1 ratio diagonal, not radial
```

The spine forms a diagonal line with a 2:1 X:Y ratio, establishing the primary asymmetric axis.

**Ribs - Alternating Sides:**
```typescript
side = (i % 2 === 0) ? 1 : -1;  // Flip-flop pattern
ribOffset = {
    x: -targetSpacing * initScale * 0.25 * side,  // +/-9.4px
    y: targetSpacing * initScale * 0.5 * side     // +/-18.75px
}
// Creates "volume" perpendicular to spine
```

Ribs attach to random spine nodes and alternate sides, creating a 3D-like volume effect.

**Fibers - Random Scatter:**
```typescript
fiberOffset = {
    x: (rng.next() - 0.5) * targetSpacing * initScale * 0.67,  // +/-25px
    y: (rng.next() - 0.5) * targetSpacing * initScale * 0.67
}
// Fuzzy outer boundary
```

Fibers attach to random rib nodes with random offsets, creating the fuzzy outer layer.

**Result**: Nodes start in an **elongated, diagonal cluster** (~37px x 18px), NOT a circle.

---

## 2. Initial Impulse (The "Kick")

### Topology-Weighted Directional Force

```typescript
// fireInitialImpulse() in engine.ts
forceBase = clamp(targetSpacing * snapImpulseScale, 120, 600)
           = clamp(375 * 0.4, 120, 600) = 150

roleWeight:
  spine: 1.5  (strongest kick)
  rib:   1.0  (medium kick)
  fiber: 0.5  (weakest kick)
```

**Direction**: Calculated from spring vectors (where links want to pull nodes)  
**Magnitude**: Weighted by role -> spine nodes fly fastest, fibers drift slower

The impulse is applied once at t=0, giving each node an initial velocity based on:
- The direction of its spring connections
- Its topological role (spine/rib/fiber)

**Result**: Nodes **explode outward** along their structural connections, preserving the diagonal asymmetry.

---

## 3. Time-Gated Snap Phases (300ms Lifecycle)

### Flight Phase (0-200ms)
```typescript
dampingEffective = 0.30  // Low damping, high speed
maxVelocityEffective = 1500  // Allow fast motion
Springs: DISABLED  // Pure ballistic flight
```

Nodes fly outward with minimal resistance, following impulse directions. Springs are disabled to allow free expansion.

### Freeze Phase (200-300ms)
```typescript
node.vx = 0; node.vy = 0;  // ABSOLUTE ARREST
Springs: DISABLED
Position: LOCKED
```

Motion authority revoked. Nodes freeze mid-flight at exactly 200ms. This creates a decisive "snap" endpoint.

### Settle Phase (300ms+)
```typescript
dampingEffective = 0.90  // High damping, slow drift
maxVelocityEffective = 80  // Cap speed
Springs: ENABLED  // Pull to targetSpacing
```

Springs activate, pulling nodes to their rest length (375px). High damping prevents bouncing and creates smooth settling.

**Result**: **Snap -> Freeze -> Swirl -> Settle**

The "swirl" is rotational momentum as springs resolve tension from the frozen positions.

---

## 4. Force Balance (Ongoing Physics)

### Spring Forces
```typescript
// applySprings() in forces.ts
effectiveLength = targetSpacing * lengthBias
  spine-spine: 375 * 0.5 = 187.5px
  rib-spine:   375 * 1.0 = 375px
  fiber-rib:   375 * 1.5 = 562.5px

Force = springStiffness * (currentDist - effectiveLength)
      = 0.2 * displacement
```

Pulls connected nodes toward their target distance. **Varied lengths** create depth and layering.

### Repulsion Forces
```typescript
// applyRepulsion() in forces.ts
repulsionStrength = 800
repulsionDistanceMax = 150px

Force proportional_to 1/distance^2 (inverse square law)
```

Pushes nearby nodes apart. Prevents overlap and creates "breathing room" between unconnected nodes.

### Collision Forces
```typescript
collisionPadding = 8px
collisionStrength = 2000

if (overlap > 0):
    Force = overlap * collisionStrength
```

Hard shell collision. Nodes cannot penetrate each other's radius + 8px padding.

### Center Gravity (Weak Leash)
```typescript
gravityCenterStrength = 0.01  // Very weak
Force = strength * distance_from_origin
```

Gentle pull toward (0,0). Prevents infinite drifting but doesn't compress the graph.

**Result**: Springs create **structure**, repulsion creates **space**, collision prevents **overlap**, gravity prevents **escape**.

---

## 5. Shape Emergence Factors

### Why It's Organic (Not Circular):

1. **Asymmetric Initial Placement**: Diagonal spine axis (2:1 ratio)
2. **Varied Link Lengths**: 0.5x, 1.0x, 1.5x bias creates layering
3. **Topology-Weighted Impulse**: Spine flies faster than fibers
4. **Hierarchical Mass**: Heavy spine anchors, light fibers drift
5. **Deterministic Randomness**: Seeded RNG creates reproducible "natural" variation
6. **Time-Gated Dynamics**: Freeze phase locks in asymmetric flight positions

### Shape Diagnostics Explained:

```
Spread (R_mean): 184.10 px  <- Average node distance from center
Irregularity (R_std): 93.32 px  <- High variance = organic
CV (Std/Mean): 0.507  <- 50% variation = very irregular
Aspect Ratio (W/H): 1.323  <- Elongated, not circular
```

**High CV (0.507)** = nodes are scattered at varied distances, not uniform radius (circle would be ~0.1)  
**Aspect Ratio (1.323)** = wider than tall, preserving diagonal bias from spine axis

---

## 6. Camera Framing (Presentation Layer)

```typescript
// AABB calculation
minX, maxX, minY, maxY = bounding box of all nodes
centerX = (minX + maxX) / 2
centerY = (minY + maxY) / 2

// Safe rect (15% margin)
safeRect = viewport inset by 15%

// Camera target
requiredZoom = fit AABB in safeRect (max 1.0)
requiredPanX/Y = center AABB in viewport

// Smooth transition
panX += (requiredPanX - panX) * 0.15
zoom += (requiredZoom - zoom) * 0.15
```

Camera **follows** the graph, keeping it centered and visible. Doesn't affect physics - purely presentation.

The 15% dampingFactor creates smooth camera motion that feels organic and non-jarring.

---

## Summary: The Recipe

1. **Seed** -> Deterministic randomness (same seed = same shape)
2. **Topology** -> Spine-rib-fiber hierarchy
3. **Asymmetric Placement** -> Diagonal axis, alternating ribs, scattered fibers
4. **Weighted Impulse** -> Spine flies fast, fibers drift
5. **Time-Gated Snap** -> Flight (200ms) -> Freeze (100ms) -> Settle
6. **Force Balance** -> Springs (structure) + Repulsion (space) + Collision (solidity)
7. **Camera Leash** -> Automatic framing

**Result**: A **reproducible, organic, asymmetric** graph that snaps decisively, swirls gracefully, and settles into a structured-yet-natural shape.

---

## Key Parameters

| Parameter | Value | Effect |
|-----------|-------|--------|
| `targetSpacing` | 375 | Base spring rest length |
| `initScale` | 0.1 | Initial compression (10% of targetSpacing) |
| `snapImpulseScale` | 0.4 | Impulse strength multiplier |
| `springStiffness` | 0.2 | How strongly springs pull |
| `repulsionStrength` | 800 | How strongly nodes push apart |
| `collisionPadding` | 8 | Minimum gap between nodes |
| `dampingSnap` | 0.30 | Low damping during flight |
| `dampingSettle` | 0.90 | High damping during settle |
| `maxVelocitySnap` | 1500 | Speed cap during flight |
| `maxVelocitySettle` | 80 | Speed cap during settle |

Every element contributes to breaking radial symmetry and creating the beautiful organic form.
