# System Architecture – Obsidian-Style Graph Physics Engine

## Overview

This document describes the **complete system architecture** of the graph physics engine, how components interlink, data flow, and the design philosophy behind each layer.

**Purpose**: Enable developers and AI agents to understand the entire system without jumping blind between files.

**Companion Documents**:
- [vision.md](./vision.md) - UX goals and experience anchors
- [organic-shape-creation.md](../src/docs/organic-shape-creation.md) - How the organic shape emerges

---

## Table of Contents

1. [System Layers](#system-layers)
2. [Component Map](#component-map)
3. [Data Flow](#data-flow)
4. [Physics Pipeline](#physics-pipeline)
5. [Configuration System](#configuration-system)
6. [Key Algorithms](#key-algorithms)
7. [Extension Points](#extension-points)

---

## System Layers

The system is organized in **4 distinct layers**, each with clear responsibilities:

```
┌─────────────────────────────────────────┐
│  Layer 4: UI/Presentation               │
│  - GraphPhysicsPlayground.tsx           │
│  - Canvas rendering                     │
│  - User input handling                  │
│  - Camera system                        │
└─────────────────────────────────────────┘
              ↓ ↑
┌─────────────────────────────────────────┐
│  Layer 3: Physics Engine                │
│  - engine.ts (PhysicsEngine)            │
│  - Lifecycle management                 │
│  - Node/Link state                      │
│  - Integration loop                     │
└─────────────────────────────────────────┘
              ↓ ↑
┌─────────────────────────────────────────┐
│  Layer 2: Force Calculations            │
│  - forces.ts                            │
│  - Springs, repulsion, collision        │
│  - Boundary forces                      │
└─────────────────────────────────────────┘
              ↓ ↑
┌─────────────────────────────────────────┐
│  Layer 1: Core Types & Config           │
│  - types.ts (interfaces)                │
│  - config.ts (parameters)               │
│  - utils/seededRandom.ts                │
└─────────────────────────────────────────┘
```

**Design Principle**: **Separation of Concerns**
- Physics doesn't know about React
- Forces don't know about lifecycle
- UI doesn't know about force calculations

---

## Component Map

### Core Physics (`src/physics/`)

#### `types.ts` - Type Definitions
**Purpose**: Single source of truth for all data structures

**Key Interfaces**:
```typescript
PhysicsNode {
  id, x, y, vx, vy,        // Position & velocity
  radius, mass,             // Physical properties
  role, warmth, pinned      // Behavioral flags
}

PhysicsLink {
  source, target,           // Node IDs
  length, lengthBias        // Spring properties
}

ForceConfig {
  // Spacing controls (Phase 1-4)
  targetSpacing, initScale, snapImpulseScale,
  
  // Force strengths
  springStiffness, repulsionStrength, collisionStrength,
  
  // Timing & damping
  damping, maxVelocity, formingTime
}
```

**Interlinking**: Referenced by ALL other components

---

#### `config.ts` - Default Configuration
**Purpose**: Centralized parameter tuning

**Key Values** (Phase 4):
```typescript
targetSpacing: 375        // 25% reduction from 500
initScale: 0.1           // Initial compression
snapImpulseScale: 0.4    // Impulse strength
collisionPadding: 8      // Node spacing
damping: 0.90            // High friction
```

**Interlinking**:
- Imported by `engine.ts` as defaults
- Imported by `GraphPhysicsPlayground.tsx` for UI sliders
- Modified at runtime via UI controls

---

#### `engine.ts` - Physics Engine Core
**Purpose**: Orchestrates the entire simulation

**Key Responsibilities**:
1. **State Management**: Maintains `Map<id, PhysicsNode>` and `PhysicsLink[]`
2. **Lifecycle Tracking**: Unified energy-based decay (no phase switches)
3. **Integration Loop**: Euler integration (velocity → position)
4. **Force Coordination**: Calls force functions from `forces.ts`
5. **Impulse System**: One-time initial "kick" at t=0
6. **Rotating Medium**: Global rotation independent of node physics

**Key Methods**:
```typescript
addNode(node)              // Add to simulation
addLink(link)              // Create connection
tick(dt)                   // Main update loop
applyDrag(nodeId, x, y)    // User interaction
fireInitialImpulse()       // Snap kick + spin init (private)
getGlobalAngle()           // Get rotation for rendering
getCentroid()              // Get graph center
```

**Lotus Leaf Settling Model**:
```typescript
// Unified energy decay (no phase switches)
globalEnergy = exp(-lifecycle / τ)    // τ = 0.3s (300ms time constant)

// Force scaling
forces *= globalEnergy                // Forces weaken as energy decays

// Damping increases as energy falls
damping = 0.3 + 0.68 × (1 - globalEnergy)  // 0.3 → 0.98

// Rotating medium (initialized at impulse)
globalAngularVel *= exp(-spinDamping * dt)
globalAngle += globalAngularVel * dt

// Water micro-drift (alive stillness)
microDrift = sin(t*0.3)*0.0008 + sin(t*0.7)*0.0004 + sin(t*1.1)*0.0002
globalAngle += microDrift * dt
```

**Key Properties**:
- **No phase switches**: Energy decays continuously from t=0
- **No capture moments**: Spin initialized at birth, not sampled later
- **Asymptotic settling**: Motion never stops suddenly, just fades
- **Rotating medium**: Physics runs in local space, rotation applied at render time
- **Water feel**: Micro-drift makes stillness feel alive, not frozen

**Interlinking**:
- Uses types from `types.ts`
- Uses config from `config.ts`
- Calls force functions from `forces.ts`
- Instantiated by `GraphPhysicsPlayground.tsx`

---

#### `forces.ts` - Force Calculation Library
**Purpose**: Pure force calculation functions (no state)

**Key Functions**:

**1. `applyRepulsion(nodes, config)`**
- **What**: Inverse-square law push between ALL node pairs
- **Why**: Prevents overlap, creates "breathing room"
- **Formula**: `F ∝ 1/distance²` (capped at `repulsionDistanceMax`)

**2. `applySprings(nodes, links, config, stiffnessScale)`**
- **What**: Hooke's law pull along links
- **Why**: Maintains structure, creates rest length
- **Formula**: `F = k * (currentDist - targetDist)`
- **Varied Lengths**: Spine (0.5x), Rib (1.0x), Fiber (1.5x)

**3. `applyCollision(nodes, config)`**
- **What**: Hard-shell collision response
- **Why**: Absolute minimum spacing guarantee
- **Formula**: `F = overlap * collisionStrength` (if overlap > 0)

**4. `applyBoundaryForce(nodes, config, canvasWidth, canvasHeight)`**
- **What**: Soft push from screen edges
- **Why**: Keeps graph visible without hard clipping
- **Formula**: Exponential ramp near edges

**Design**: All functions are **pure** - they modify node velocities but don't manage state.

**Interlinking**:
- Called by `engine.ts` in `tick()` loop
- Uses types from `types.ts`
- Uses config from `config.ts`

---

### Utilities (`src/utils/`)

#### `seededRandom.ts` - Deterministic PRNG
**Purpose**: Reproducible random number generation

**Algorithm**: Linear Congruential Generator (LCG)
```typescript
X_{n+1} = (a * X_n + c) mod m
```

**Why**: Same seed → identical graph topology → reproducible presets

**Interlinking**:
- Used by `generateRandomGraph()` in `GraphPhysicsPlayground.tsx`
- Seed stored in UI state

---

### UI Layer (`src/playground/`)

#### `GraphPhysicsPlayground.tsx` - Main Application
**Purpose**: React component that ties everything together

**Key Responsibilities**:

**1. Graph Generation** (`generateRandomGraph()`)
- Creates Spine-Rib-Fiber topology
- Asymmetric initial placement (diagonal axis)
- Seeded randomness for reproducibility

**2. Rendering Loop**
- Canvas-based 2D rendering
- Camera system (pan, zoom, auto-framing)
- 60 FPS animation loop

**3. User Interaction**
- Mouse drag (applies forces via `engine.applyDrag()`)
- Keyboard shortcuts ('U' to toggle UI)
- Parameter sliders (modify `config` in real-time)

**4. UI Panels**
- **Debug Overlay**: FPS, metrics, shape diagnostics
- **Sidebar**: Controls, sliders, preset logging

**5. Camera System**
- AABB calculation (bounding box of all nodes)
- Auto-framing with 15% margin
- Smooth damped transitions

**Data Flow**:
```
User Input → React State → PhysicsEngine → Forces → Node State → Render
     ↑                                                              ↓
     └──────────────────────────────────────────────────────────────┘
```

**Interlinking**:
- Imports `PhysicsEngine` from `engine.ts`
- Imports types from `types.ts`
- Imports config from `config.ts`
- Imports `SeededRandom` from `utils/seededRandom.ts`

---

## Data Flow

### Initialization Flow

```
1. App Start
   ↓
2. GraphPhysicsPlayground mounts
   ↓
3. Create PhysicsEngine instance
   ↓
4. generateRandomGraph(seed)
   ├─ Create nodes (Spine → Rib → Fiber)
   ├─ Create links (hierarchical)
   └─ Use SeededRandom for placement
   ↓
5. engine.addNode() for each node
   ↓
6. engine.addLink() for each link
   ↓
7. engine.fireInitialImpulse() (automatic at t=0)
   ↓
8. Start render loop (requestAnimationFrame)
```

### Per-Frame Update Flow

```
1. requestAnimationFrame callback
   ↓
2. Calculate dt (delta time)
   ↓
3. engine.tick(dt)
   ├─ Update lifecycle timer
   ├─ Calculate globalEnergy = exp(-lifecycle / τ)
   ├─ Apply forces (always):
   │  ├─ applyRepulsion()
   │  ├─ applySprings()
   │  ├─ applyCollision()
   │  └─ applyBoundaryForce()
   ├─ Scale forces by globalEnergy
   ├─ Update rotating medium:
   │  ├─ Decay globalAngularVel
   │  ├─ Accumulate globalAngle
   │  └─ Add water micro-drift
   ├─ Integrate velocity → position (Euler)
   ├─ Apply unified damping (increases with energy decay)
   ├─ Clamp velocity
   └─ Update warmth (activity tracking)
   ↓
4. Calculate camera target (AABB)
   ↓
5. Smooth camera transition
   ↓
6. Render to canvas
   ├─ Clear screen
   ├─ Apply camera transform
   ├─ Apply global rotation (globalAngle around centroid)
   ├─ Draw links
   ├─ Draw nodes
   └─ Draw debug overlay
   ↓
7. Update metrics (FPS, shape diagnostics)
   ↓
8. Schedule next frame
```

### User Interaction Flow

**Drag Event**:
```
1. onMouseDown → Capture node under cursor
   ↓
2. onMouseMove → engine.applyDrag(nodeId, mouseX, mouseY)
   ├─ Set node.pinned = true
   ├─ Set node.x/y to mouse position
   └─ Set node.vx/vy = 0
   ↓
3. onMouseUp → node.pinned = false
   ↓
4. Physics resumes, node settles
```

**Parameter Change**:
```
1. User moves slider
   ↓
2. React setState(newConfig)
   ↓
3. useEffect → engine.updateConfig(newConfig)
   ↓
4. Next tick() uses new parameters
```

---

## Physics Pipeline

### Force Application Order (in `tick()`)

```typescript
// Calculate energy envelope (continuous decay)
const tau = 0.3;  // 300ms time constant
const energy = Math.exp(-this.lifecycle / tau);
const forceScale = energy;

// Damping increases as energy falls
const baseDamping = 0.3;
const maxDamping = 0.98;
const effectiveDamping = baseDamping + (maxDamping - baseDamping) * (1 - energy);

// Apply all forces (always active)
applyRepulsion()      // Push apart
applySprings()        // Pull together (always active)
applyCollision()      // Hard shell
applyBoundaryForce()  // Screen containment

// Scale forces by energy envelope
for (node of nodes) {
  node.fx *= forceScale;
  node.fy *= forceScale;
}

// Update rotating medium
globalAngularVel *= Math.exp(-spinDamping * dt);
globalAngle += globalAngularVel * dt;
microDrift = sin(t*0.3)*0.0008 + sin(t*0.7)*0.0004 + sin(t*1.1)*0.0002;
globalAngle += microDrift * dt;

// Integration (always runs)
node.vx += ax * dt;
node.vy += ay * dt;
node.x += node.vx * dt;
node.y += node.vy * dt;

// Unified damping (increases with energy decay)
node.vx *= (1 - effectiveDamping * dt * 5.0);
node.vy *= (1 - effectiveDamping * dt * 5.0);

// Velocity clamping
speed = clamp(speed, 0, maxVelocityEffective);
```

### Why This Order?

1. **Repulsion first**: Establishes personal space
2. **Springs second**: Pulls structure together (always active)
3. **Collision third**: Hard constraint override
4. **Boundary last**: Soft screen containment
5. **Energy scaling**: All forces weaken together as energy decays
6. **Rotating medium**: Independent of node physics, applied at render time

---

## Configuration System

### Parameter Categories

**Spacing Controls** (Phase 1-4):
```typescript
targetSpacing: 375        // Spring rest length
initScale: 0.1           // Initial compression
snapImpulseScale: 0.4    // Impulse multiplier
collisionPadding: 8      // Minimum gap
```

**Force Strengths**:
```typescript
springStiffness: 0.2     // Spring pull strength
repulsionStrength: 800   // Push strength
collisionStrength: 2000  // Hard shell strength
```

**Timing & Damping**:
```typescript
damping: 0.90            // Base friction
formingTime: 2.0         // Phase transition time
maxVelocity: 80          // Speed cap
```

**Boundaries**:
```typescript
boundaryMargin: 50       // Edge detection distance
boundaryStrength: 50     // Push strength
```

### Runtime Modification

All parameters can be changed via UI sliders:
```typescript
const handleConfigChange = (key, value) => {
  setConfig(prev => ({ ...prev, [key]: value }));
};

useEffect(() => {
  engineRef.current.updateConfig(config);
}, [config]);
```

---

## Key Algorithms

### 1. Spine-Rib-Fiber Topology Generation

**Purpose**: Create asymmetric structure that breaks radial symmetry

**Algorithm**:
```typescript
1. Calculate node counts:
   - Spine: 3-5 nodes (10% of total)
   - Rib: 60-75% of remaining
   - Fiber: rest

2. Place Spine (diagonal axis):
   - Start at random offset
   - Step: (targetSpacing * initScale, targetSpacing * initScale * 0.5)
   - Creates 2:1 X:Y ratio

3. Place Ribs (alternating sides):
   - Attach to random spine node
   - Offset perpendicular to spine
   - side = (i % 2 === 0) ? 1 : -1

4. Place Fibers (random scatter):
   - Attach to random rib node
   - Random offset from rib

5. Create Links:
   - Spine: chain with occasional branching
   - Rib: to spine anchor + 20% double-link
   - Fiber: to rib anchor
```

**Why**: Creates organic, elongated shape instead of circle

---

### 2. Unified Energy-Based Settling

**Purpose**: Create "lotus leaf floating on water" behavior with asymptotic decay

**Algorithm**:
```typescript
// Single energy curve governs everything
const tau = 0.3;  // 300ms time constant
globalEnergy = Math.exp(-lifecycle / tau);

// Forces scale with energy (weaken over time)
forceScale = globalEnergy;
for (node of nodes) {
  node.fx *= forceScale;
  node.fy *= forceScale;
}

// Damping increases as energy falls
baseDamping = 0.3;
maxDamping = 0.98;
effectiveDamping = baseDamping + (maxDamping - baseDamping) * (1 - globalEnergy);

// Rotating medium (initialized at impulse, decays independently)
globalAngularVel *= Math.exp(-spinDamping * dt);
globalAngle += globalAngularVel * dt;

// Water micro-drift (alive stillness)
microDrift = sin(t*0.3)*0.0008 + sin(t*0.7)*0.0004 + sin(t*1.1)*0.0002;
globalAngle += microDrift * dt;
```

**Why**: 
- No phase switches → smooth continuous motion
- No capture moments → spin initialized at birth
- Asymptotic decay → motion never "stops", just fades
- Rotating medium → physics and rotation are orthogonal
- Water feel → micro-drift makes stillness alive, not frozen

---

### 3. Camera Auto-Framing

**Purpose**: Keep graph visible without physics forces

**Algorithm**:
```typescript
1. Calculate AABB (Axis-Aligned Bounding Box):
   minX, maxX, minY, maxY = bounds of all nodes

2. Calculate center:
   centerX = (minX + maxX) / 2
   centerY = (minY + maxY) / 2

3. Calculate required zoom:
   width = maxX - minX
   height = maxY - minY
   safeWidth = canvasWidth * 0.7   // 15% margin each side
   safeHeight = canvasHeight * 0.7
   zoom = min(safeWidth / width, safeHeight / height, 1.0)

4. Smooth transition:
   panX += (targetPanX - panX) * 0.15
   zoom += (targetZoom - zoom) * 0.15
```

**Why**: Separates presentation from physics

---

## Extension Points

### Adding New Forces

**Location**: `src/physics/forces.ts`

**Template**:
```typescript
export function applyMyForce(
  nodes: Map<string, PhysicsNode>,
  config: ForceConfig
) {
  for (const node of nodes.values()) {
    // Calculate force
    const fx = ...;
    const fy = ...;
    
    // Apply to velocity
    node.vx += fx;
    node.vy += fy;
  }
}
```

**Integration**: Call in `engine.ts` `tick()` method

---

### Adding New Parameters

**Steps**:
1. Add to `ForceConfig` in `types.ts`
2. Add default value in `config.ts`
3. Use in force calculations
4. UI slider auto-generates from config keys

---

### Adding New Lifecycle Phases

**Location**: `src/physics/engine.ts` in `tick()`

**Pattern**:
```typescript
if (this.lifecycle < PHASE_1_TIME) {
  // Phase 1 behavior
} else if (this.lifecycle < PHASE_2_TIME) {
  // Phase 2 behavior
} else {
  // Final phase
}
```

---

## File Dependency Graph

```
main.tsx
  └─→ GraphPhysicsPlayground.tsx
       ├─→ PhysicsEngine (engine.ts)
       │    ├─→ types.ts
       │    ├─→ config.ts
       │    └─→ forces.ts
       │         ├─→ types.ts
       │         └─→ config.ts
       └─→ SeededRandom (utils/seededRandom.ts)
```

**Key Insight**: `types.ts` and `config.ts` are leaf nodes - they have no dependencies.

---

## Summary

**System Philosophy**:
1. **Layered Architecture**: Clear separation between UI, engine, forces, and config
2. **Pure Functions**: Force calculations are stateless
3. **Centralized Config**: Single source of truth for parameters
4. **Deterministic**: Seeded randomness for reproducibility
5. **UX-Driven**: Physics serves experience, not mathematical purity

**Key Innovation**: Unified energy-based settling creates "lotus leaf on water" feel:
- Single energy curve governs all motion
- Rotating medium independent of node physics
- Asymptotic decay (never stops, just fades)
- Water micro-drift makes stillness feel alive

**Extension Strategy**: Add new forces, parameters, or behaviors without touching core architecture.

---

**Next Steps**: Read [vision.md](./vision.md) for UX goals, then [organic-shape-creation.md](../src/docs/organic-shape-creation.md) for detailed shape emergence explanation.
