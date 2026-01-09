# System Architecture – Obsidian-Style Graph Physics Engine

## Repository Structure

```
.
├── docs/
│   ├── physics-engine-audit.md
│   ├── system.md
│   ├── tuning-guide.md
│   └── vision.md
├── public/
│   └── Quicksand-Light.ttf
├── src/
│   ├── assets/
│   │   └── Quicksand-Light.ttf
│   ├── docs/
│   │   └── organic-shape-creation.md
│   ├── physics/
│   │   ├── config.ts
│   │   ├── engine/
│   │   │   ├── constraints.ts
│   │   │   ├── corrections.ts
│   │   │   ├── debug.ts
│   │   │   ├── degrees.ts
│   │   │   ├── energy.ts
│   │   │   ├── escapeWindow.ts
│   │   │   ├── forcePass.ts
│   │   │   ├── impulse.ts
│   │   │   ├── integration.ts
│   │   │   ├── preRollPhase.ts
│   │   │   ├── stats.ts
│   │   │   ├── velocity/              ← Modularized velocity passes
│   │   │   │   ├── angleResistance.ts
│   │   │   │   ├── angularVelocityDecoherence.ts
│   │   │   │   ├── baseIntegration.ts
│   │   │   │   ├── carrierFlow.ts
│   │   │   │   ├── damping.ts
│   │   │   │   ├── debugVelocity.ts
│   │   │   │   ├── denseCoreInertiaRelaxation.ts
│   │   │   │   ├── denseCoreVelocityUnlock.ts
│   │   │   │   ├── distanceBias.ts
│   │   │   │   ├── dragVelocity.ts
│   │   │   │   ├── edgeShearStagnationEscape.ts
│   │   │   │   ├── energyGates.ts
│   │   │   │   ├── expansionResistance.ts
│   │   │   │   ├── hubVelocityScaling.ts
│   │   │   │   ├── localPhaseDiffusion.ts
│   │   │   │   ├── lowForceStagnationEscape.ts
│   │   │   │   ├── preRollVelocity.ts
│   │   │   │   ├── relativeVelocityUtils.ts
│   │   │   │   └── staticFrictionBypass.ts
│   │   │   └── velocityPass.ts        ← Thin facade re-exporting velocity modules
│   │   ├── engine.ts
│   │   ├── forces.ts
│   │   ├── test-physics.ts
│   │   └── types.ts
│   ├── playground/
│   │   └── GraphPhysicsPlayground.tsx
│   ├── utils/
│   │   └── seededRandom.ts
│   ├── index.css
│   └── main.tsx
├── index.html
├── package-lock.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Core Physics Architecture

### `engine.ts` - Tick Orchestrator

Central coordinator owning the simulation loop and phase gating:

**Main Loop:**
- `tick(dt)`: Full frame lifecycle with energy envelope
- Lifecycle management (`preRollFrames`, `frameIndex`, `hasFiredImpulse`)
- Energy computation via `computeEnergyEnvelope()`

**Subsystem Delegation:**
1. **Force Pass** → `applyForcePass()`  
   Springs, repulsion, collision, boundary forces
   
2. **Integration** → `integrateNodes()`  
   Temporal decoherence (dt skew), priority bands, velocity/position updates
   
3. **Velocity Shaping** → Early expansion optimizations:
   - `applyExpansionResistance()` - Multi-connection damping
   - `applyDenseCoreVelocityDeLocking()` - Rigid-body unlock
   - `applyStaticFrictionBypass()` - Zero-velocity shear injection
   
4. **Constraints** → Position correction requests:
   - Spacing constraints (soft/hard zones, escape windows)
   - Triangle area preservation
   - Edge relaxation
   - Safety clamp
   
5. **Corrections** → `applyCorrectionsWithDiffusion()`  
   Budget-limited position writes with neighbor diffusion

**State Management:**
- Node/link CRUD, wake/sleep, bounds
- Degree calculation, neighbor maps
- Escape windows, carrier direction persistence
- Clamped pair hysteresis tracking

### Velocity Module Architecture

**`engine/velocity/` - Modularized Velocity Passes**

Each file handles one specific velocity concern (~100-400 lines each):

| Module | Purpose |
|--------|---------|
| `dragVelocity.ts` | User drag interaction velocity |
| `preRollVelocity.ts` | Initial spacing + micro-rotation carrier |
| `carrierFlow.ts` | Trapped hub tangential flow + directional persistence |
| `hubVelocityScaling.ts` | Hub damping (with dense-core bypass) |
| `expansionResistance.ts` | Multi-connection resistance (with dense-core bypass) |
| `angleResistance.ts` | Angular constraint enforcement (phase-aware) |
| `distanceBias.ts` | Min-distance velocity projection + slop zone |
| `denseCoreVelocityUnlock.ts` | Breaks rigid-body velocity alignment (20% parallel reduction) |
| `staticFrictionBypass.ts` | Zero-velocity rest state unlock (perpendicular shear) |
| `angularVelocityDecoherence.ts` | **NEW:** Breaks velocity orientation correlation (0.5-1.5° rotation) |
| `localPhaseDiffusion.ts` | **NEW:** Breaks oscillation synchronization (0.3-0.8° phase shift) |
| `edgeShearStagnationEscape.ts` | **NEW:** Pairwise perpendicular slip on jammed edges |
| `denseCoreInertiaRelaxation.ts` | **NEW:** Erases momentum memory via neighbor flow blending |
| `baseIntegration.ts` | Core velocity integration utilities |
| `damping.ts` | Unified damping application |
| `relativeVelocityUtils.ts` | Relative velocity calculations |
| `debugVelocity.ts` | Debug helpers |
| `energyGates.ts` | Energy-based gating utilities |

**Benefits:**
- Single responsibility per module
- Easier testing and debugging
- Clear dependency tracking
- 60-400 lines per file vs 950-line monolith

### Force Architecture

**`forces.ts` - Force Application**

Core force functions with early expansion optimizations:

**`applyRepulsion()`**
- Standard 1/r repulsion
- **Repulsion dead-core:** 10% → 100% strength ramp within 12px (smoothstep)
- **Density-dependent boost (energy > 0.85):**
  - Base: +30% per neighbor beyond 2
  - Distance multiplier: 1.0 → 2.0 when close (within minNodeDistance)
  - Max clamp: 3.0x normal repulsion
  - Makes dense cores "higher potential" without centroid logic

**`applySprings()`**
- Soft spring with dead-zone (perceptual uniformity)
- Early-expansion dead-zone bypass for hubs
- **Tangential softening (energy > 0.85, localDensity >= 4):**
  - Decompose force: radial (100%) + tangential (5%-100%)
  - Density ramp: smoothstep d0=2 to d1=6
  - Compression boost: 1.0 → 1.5 when spring compressed
  - Allows shear without compromising distance constraints
- **Temporal force dithering (energy > 0.85, dense cores):**
  - Time-varying tangential perturbation (±0.02 force)
  - Hash(edgeId + frameIndex) → oscillatory phase [-1, 1]
  - Zero-mean over time, breaks force equilibrium
  - Pairwise symmetric
- Hub spring softening (degree-based fade)

**`applyCollision()`**
- Hard collision shell with padding
- Personal space enforcement

**`applyBoundaryForce()`**
- Repulsive boundary containment

### Integration Architecture

**`integration.ts` - Temporal & Spatial Control**

**Temporal Decoherence (energy > 0.85):**
```typescript
// Hash-based dt skew: ±3% variation per node
nodeDt = dt * (0.97 to 1.03)  // deterministic
```
- Breaks time symmetry
- Prevents equilibrium formation
- Nodes integrate at slightly different rates

**Persistent Integration Priority Bands:**
- Hash-derived priority sorting during energy > 0.85
- Consistent order every frame (no symmetric re-locking)
- Solver-level asymmetry

**Spawn Micro-Cloud:**
- One-time deterministic jitter at t=0
- 2-6px radius disc (sqrt distribution for uniform area)
- Destroys central singularity before physics starts
- Zero runtime cost

## Early Expansion Optimization Stack

The "paperglue center cluster" problem was addressed through a multi-layered approach:

### Layer 1: Solver Symmetry Breaking
- ✅ Temporal decoherence (dt skew ±3%)
- ✅ Integration priority bands (hash-based ordering)
- ✅ Spawn micro-cloud (2-6px initial jitter)

### Layer 2: Force Field Shaping
- ✅ Repulsion dead-core (10% → 100% within 12px)
- ✅ Density-dependent repulsion boost (+30% per neighbor)
- ✅ Distance-based multiplier (2x at close range)
- ✅ Temporal force dithering (±0.02 tangential oscillation)

### Layer 3: Constraint Softening
- ✅ Tangential spring softening in dense cores (5%-100%)
- ✅ Smooth density ramp (d0=2, d1=6)
- ✅ Compression-aware scaling (1.0 → 1.5)

### Layer 4: Velocity Decorrelation
- ✅ Dense-core velocity de-locking (20% parallel reduction)
- ✅ Static friction bypass (0.02 px/frame perpendicular shear)
- ✅ Angular velocity decoherence (0.5-1.5° rotation)
- ✅ Local phase diffusion (0.3-0.8° phase shift)

### Layer 5: Stagnation Breaking
- ✅ Edge shear stagnation escape (pairwise perpendicular slip)
- ✅ Dense-core inertia relaxation (momentum memory erasure)

**Current Status:** Significant reduction in early-phase stickiness. Center cluster exhibits improved fluidity compared to baseline. Remaining ~10% "coffin nail" nodes under investigation.

**Result:** Center behaves more fluidly during early expansion (t=0-200ms), though some positional anchoring persists in very dense configurations.

## Constraints & Corrections

**`constraints.ts` - Position Correction Requests**

Budget-based position correction system:

- **Spacing Constraints:** Soft → Hard zones with hysteresis
- **Triangle Area:** Preserve local topology shape
- **Edge Relaxation:** Post-solve uniformity
- **Safety Clamp:** Deep penetration recovery (rare)

**Budget System:**
- Per-node correction accumulator
- Clamped to prevent multi-constraint pileup
- Degree-aware scaling (hubs privileged)

**`corrections.ts` - Diffusion & Application**

- Neighbor diffusion (reduces local clustering)
- Final position writes
- Escape window management

## Debug & Instrumentation

**`stats.ts` - Per-Frame Aggregation**

Tracks:
- Force/velocity/correction totals per pass
- Affected node counts
- Safety metrics (clamps, escapes, trapped hubs)
- Pass-specific diagnostics

**Console Logging (Early Expansion):**
```
[Frame 3] dt skew: 0.016120 - 0.017160 (base dt: 0.016667)
[Repulsion] avgCenterDensity: 5.2, maxDensityBoost: 2.34
[Springs] minTangentScale: 0.087, srcDensity: 5, tgtDensity: 4
[VelocityDeLocking] affected: 8 nodes
[StaticFrictionBypass] unlocked: 3 nodes
```

## Key Design Principles

1. **Solver-Level Over Force-Level:** Break symmetry at integration, not force math
2. **Local Over Global:** Density-based, no centroid logic
3. **Deterministic:** Hash-based, reproducible
4. **Self-Disabling:** Energy/density gating, auto-cleanup
5. **Smooth Transitions:** Smoothstep ramps, no hard gates
6. **Minimal & Clean:** Single-purpose modules, clear ownership
7. **Water-Like Motion:** Fluid dynamics metaphors, not mechanical

## Configuration

**`config.ts` - Tuning Constants**

Key parameters:
- `repulsionStrength`, `repulsionDistanceMax`
- `springStiffness`, `linkRestLength`, `springDeadZone`
- `minNodeDistance`, `contactSlop`, `clampHysteresisMargin`
- `expansionResistance`
- `velocitySleepThreshold`, `maxVelocityEarly`, `maxVelocityLate`

## Why This Architecture Works

**Separation of Concerns:**
- Forces shape acceleration field
- Velocity passes add controlled motion patterns
- Integration controls time/space resolution
- Constraints enforce geometric invariants
- Corrections apply budgeted position fixes

**Phase-Aware Behavior:**
- Early expansion (energy > 0.85): Fluid, asymmetric, loose constraints
- Mid expansion (0.7 < energy < 0.85): Transition
- Late settling (energy ≤ 0.7): Rigid, symmetric, tight constraints

**Maintainability:**
- Each module ~60-400 lines
- Clear imports/exports
- Testable in isolation
- Self-documenting structure
