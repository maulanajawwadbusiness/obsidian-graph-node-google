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

---

## Visual Layer Architecture

### Theme System (`src/visual/theme.ts`)

**Centralized Visual Configuration**

Two theme modes with distinct aesthetics:

| Theme | Style | Node Rendering | Background |
|-------|-------|----------------|------------|
| **Normal** | Baseline | Filled blue circles | Flat dark |
| **Elegant v2** | Dark Power | Hollow gradient rings | Radial vignette |

**ThemeConfig Interface:**
- Master scale control (`nodeScale`)
- Gradient ring parameters (colors, segments, rotation)
- Two-layer glow system (inner/outer)
- Vignette background settings
- Hover energy system knobs
- Link styling

**Key Theme Knobs (Elegant v2):**
```typescript
// Master scale
nodeScale: 4  // Proportional scaling for radius + ring width

// Gradient ring
primaryBlueDefault: '#3d4857'  // Dark blue (no hover)
primaryBlueHover: '#63abff'    // Bright blue (hovered)
deepPurple: '#4a2a6a'          // Gradient end color
gradientRotationDegrees: 170   // Purple at bottom-left (visual gravity)
ringGradientSegments: 48       // Smooth gradient (segmented arcs)

// Two-layer glow
glowInnerColor: 'rgba(99, 171, 255, 0.22)'   // Blue, tight
glowInnerRadius: 8
glowOuterColor: 'rgba(100, 60, 160, 0.12)'   // Purple, wide
glowOuterRadius: 20

// Vignette
vignetteCenterColor: '#0f0f1a'  // Lighter indigo
vignetteEdgeColor: '#050508'    // Near-black
vignetteStrength: 0.7
```

### Rendering Pipeline (`src/playground/useGraphRendering.ts`)

**Hook Architecture (Thin Orchestrator ~256 lines):**

The `useGraphRendering` hook has been modularized from a 1300+ line monolith into a thin orchestrator that wires together specialized rendering modules. The hook manages:
- State refs (settings, pointer, hover, camera)
- Hover controller initialization
- Render loop coordination
- Window blur cleanup

**Main Render Loop (RAF-based):**

1. **Physics Tick** → `engine.tick(dt)`
2. **Hover Energy Smoothing** → `updateHoverEnergy()` with tau-based exponential lerp
3. **Canvas Setup** → DPR-aware resize, clear, vignette background
4. **Camera Containment** → `updateCameraContainment()` with leash logic
5. **Selection Update** → Pointer-throttled or camera-drift triggered
6. **Camera Transform** → `applyCameraTransform()` with rotation
7. **Link Drawing** → `drawLinks()` indigo-tinted connections
8. **Node Drawing** → `drawNodes()` mode-dependent (filled vs ring)
9. **Debug Overlays** → `drawHoverDebugOverlay()` + `drawPointerCrosshair()`
10. **Metrics Tracking** → `trackMetrics()` FPS, velocity, shape stats

**Rendering Modules (`src/playground/rendering/`):**

| Module | Responsibility | Exports |
|--------|---------------|---------|
| `renderingTypes.ts` | Shared types + initial state factories | `HoverState`, `CameraState`, `PendingPointerState`, `RenderSettingsRef`, factory functions |
| `renderingMath.ts` | Math helpers | `clamp()`, `smoothstep()`, `rotateAround()` |
| `canvasUtils.ts` | Canvas state isolation + drawing primitives | `withCtx()`, `drawVignetteBackground()`, `drawGradientRing()`, `drawTwoLayerGlow()` |
| `hoverController.ts` | Pointer lifecycle + hover selection logic | `createHoverController()` → handlers + transforms + selection |
| `hoverEnergy.ts` | Energy smoothing with dt clamp + tau guard | `updateHoverEnergy()` |
| `camera.ts` | Leash containment + camera transforms | `updateCameraContainment()`, `applyCameraTransform()` |
| `graphDraw.ts` | Graph rendering (links, nodes, debug) | `drawLinks()`, `drawNodes()`, `drawHoverDebugOverlay()`, `drawPointerCrosshair()` |
| `metrics.ts` | Performance + shape metrics tracking | `createMetricsTracker()` |

**Key Design Decisions:**

- **Single Responsibility:** Each module handles one concern (~50-200 lines)
- **No Behavioral Changes:** Modularization preserves all existing hover/camera behavior
- **Testability:** Modules can be tested in isolation
- **State Isolation:** Canvas state wrapped in `withCtx()` to prevent leaks
- **Performance:** Selection throttled to pointer events + camera drift only

**Coordinate Transforms:**
```
Screen (clientX, clientY)
    ↓ getBoundingClientRect() → CSS pixels
Canvas (0,0 = center)
    ↓ / camera.zoom
    ↓ - camera.panX, camera.panY
    ↓ inverse global rotation around centroid
World (node coordinate space)
```

### Hover Energy System

**Architecture:** Proximity-based smooth hover with time smoothing and stable selection

**Core Concept:** `hoverEnergy` in [0..1]
- 0 = Asleep (dark blue #3d4857)
- 1 = Fully awake (bright blue #63abff)
- Smoothly interpolated via `lerpColor()`

**Canonical Radii:**
- `renderRadius` = baseRadius * nodeRadiusMultiplier
- `outerRadius` = renderRadius + ringWidth/2 (ring mode)
- `hitRadius` = outerRadius + 2px
- `haloRadius` = outerRadius * hoverHaloMultiplier

**Proximity Model (Smoothstep):**
```typescript
if (d <= hitRadius):
    targetEnergy = 1
else if (d <= haloRadius):
    t = (haloRadius - d) / (haloRadius - hitRadius)
    targetEnergy = smoothstep(t)
else:
    targetEnergy = 0
```

**Time Smoothing (Tau-based, hardened):**
```typescript
const dtClamped = clamp(dtMs, 0, 40)
const tauMs = Math.max(hoverEnergyTauMs, 1)
const alpha = 1 - exp(-dtClamped / tauMs)
energy += (targetEnergy - energy) * alpha
energy = clamp(energy, 0, 1)
```

**Selection Stability:**
- Active candidate model
- Sticky exit: `dist > halo * 1.05` to clear
- Anti ping-pong: switch only if `newDist + 8px < currentDist`
- O(1) when pointer idle; full scan only on pointer movement or exit

**Energy-Driven Rendering:**
- **Color:** `lerpColor(primaryBlueDefault, primaryBlueHover, energy)`
- **Ring Width:** `baseWidth * (1 + 0.1 * energy)`

**Debug Overlays:**
- Render radius (cyan), hit radius (magenta dashed), halo radius (yellow dashed)
- Energy text, selection decision, perf counters
- Crosshair at computed pointer world->screen

### Component Architecture (`src/playground/GraphPhysicsPlayground.tsx`)

**Main Component Responsibilities:**
- Canvas container + event wiring
- Skin toggle state (`skinMode: 'normal' | 'elegant'`)
- Drag-and-drop interaction (mouse-based)
- Spawn/reset controls
- Debug panel toggle

**Returned from Hook:**
- `handlePointerMove(pointerId, pointerType, clientX, clientY, rect)` - Hover selection
- `handlePointerEnter(pointerId, pointerType)` - Pointer lifecycle
- `handlePointerLeave(pointerId, pointerType)` - Clear hover
- `handlePointerCancel(pointerId, pointerType)` - Clear hover
- `handlePointerUp(pointerId, pointerType)` - Clear hover

**Pointer Event Flow:**
```
Component (GraphPhysicsPlayground.tsx)
    + onPointerEnter/Move/Leave/Cancel/Up
Hook (useGraphRendering.ts)
    + activePointerId tracking (ignores secondary pointers)
    + clientToWorld() (CSS px + camera + rotation)
    + updateHoverSelection() on pointer changes
    + clearHover() on leave/cancel/up/blur
Render Loop
    + Energy smoothing + ring rendering
```

**Camera State (Internal to Hook):**
- Pan/zoom with auto-framing
- Leash containment (keeps nodes in view)
- Smooth camera transitions

---

## File Organization

### Core Files

**Physics Layer:**
- `src/physics/engine.ts` - Main simulation orchestrator
- `src/physics/forces.ts` - Force application
- `src/physics/engine/integration.ts` - Temporal control
- `src/physics/engine/velocity/*.ts` - Modularized velocity passes
- `src/physics/engine/constraints.ts` - Position correction requests
- `src/physics/engine/corrections.ts` - Correction application

**Visual Layer:**
- `src/visual/theme.ts` - Theme configuration + color utilities
- `src/playground/useGraphRendering.ts` - Thin orchestrator (~256 lines)
- `src/playground/rendering/` - Modularized rendering subsystems:
  - `renderingTypes.ts` - Shared types + state factories
  - `renderingMath.ts` - Math helpers (clamp, smoothstep, rotateAround)
  - `canvasUtils.ts` - Canvas state isolation + drawing primitives
  - `hoverController.ts` - Pointer lifecycle + hover selection
  - `hoverEnergy.ts` - Energy smoothing (tau-based, dt clamp)
  - `camera.ts` - Leash containment + transforms
  - `graphDraw.ts` - Links, nodes, debug overlays
  - `metrics.ts` - FPS/velocity/shape tracking
- `src/playground/GraphPhysicsPlayground.tsx` - Main component
- `src/playground/graphRandom.ts` - Graph generation
- `src/playground/components/` - UI overlays

**Utilities:**
- `src/utils/seededRandom.ts` - Deterministic RNG

---

## Hard Invariants

1. **Normal mode unchanged** - Visual parity with baseline
2. **Camera internal** - Never expose cameraRef to component
3. **Hover disc-based** - Whole node detection, not ring-only
4. **CSS pixel space** - Use getBoundingClientRect(), avoid DPR issues
5. **Debuggability** - All systems have debug toggles + change-only logs
6. **Minimal diffs** - Only change what's necessary

---

## Development Workflow

**Running:**
```bash
npm run dev  # Vite dev server
```

**Testing Hover Energy:**
1. Set `hoverDebugEnabled: true` in theme.ts
2. Move cursor toward node -> observe cyan/magenta/yellow circles
3. Check console for hover transitions and dt clamp/spike logs
4. Verify energy text overlay and perf counters
5. Optional: set `hoverDebugStateSentinel: true` for the state log

**Tuning Knobs:**
- Physics: `src/physics/config.ts`
- Visual: `src/visual/theme.ts` (look for `// TUNING KNOB` comments)
- Master node scale: `ELEGANT_NODE_SCALE` constant

---

## Known Issues

None observed in hover energy system after stabilization passes.
