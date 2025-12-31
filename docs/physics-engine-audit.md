# Physics Engine Deep Audit & “Sharp Engine” Proposal

This document captures the deep audit request and findings, grounded in the **current source of truth** in this repo. It includes the current pipeline, overlap analysis, a proposed sharp-engine architecture, tuning model, instrumentation plan, and an incremental refactor plan.

---

## 1) Current Pipeline Diagram (order + read/write channels)

### Global Tick Order (per frame)
**Source:** `src/physics/engine.ts`

1) **Pre-roll Phase** *(only when `preRollFrames > 0 && !hasFiredImpulse`; returns early)*
   - **Pass:** `runPreRollPhase`
   - **Reads:** positions, links, config
   - **Writes:**
     - Forces (`fx/fy`)
     - Velocities (`vx/vy`)
     - Positions (`x/y`)
     - Escape window entries
   - **Notes:** This pass integrates position itself and **skips the rest of the pipeline**.
   - **Source:** `src/physics/engine/preRollPhase.ts`

2) **Impulse (one-shot, lifecycle < 0.1)**
   - **Pass:** `fireInitialImpulse`
   - **Reads:** links, config
   - **Writes:** velocity (`vx/vy`), global spin (`globalAngularVel`)
   - **Source:** `src/physics/engine/impulse.ts`

3) **Escape Window Advance**
   - **Pass:** `advanceEscapeWindow`
   - **Reads/Writes:** escape window counters
   - **Source:** `src/physics/engine/escapeWindow.ts`

4) **Energy Envelope**
   - **Pass:** `computeEnergyEnvelope`
   - **Reads:** lifecycle
   - **Writes:** `energy`, `forceScale`, `effectiveDamping`, `maxVelocityEffective`
   - **Source:** `src/physics/engine/energy.ts`

5) **Force Pass (accumulate forces)**
   - **Pass:** `applyForcePass`
   - **Reads:** positions, config, bounds, drag state
   - **Writes:** forces (`fx/fy`) and **drag-injected velocity**
   - **Subpasses:**
     - Repulsion
     - Collision (hard shell)
     - Springs
     - Boundary
     - Drag force (not energy-scaled)
   - **Source:** `src/physics/engine/forcePass.ts`, `src/physics/forces.ts`

6) **Integrate**
   - **Pass:** `integrateNodes`
   - **Reads:** forces, velocity, energy
   - **Writes:** velocity (`vx/vy`), position (`x/y`), global spin
   - **Embedded behaviors:**
     - Hub inertia (mass-like)
     - Symmetry breaking + carrier flow
     - Directional persistence (filters spring force)
     - Damping, max-velocity clamp
   - **Source:** `src/physics/engine/integration.ts`

7) **Compute Degrees**
   - **Pass:** `computeNodeDegrees`
   - **Reads:** links
   - **Writes:** degree map
   - **Source:** `src/physics/engine/degrees.ts`

8) **Expansion Resistance (velocity damping)**
   - **Pass:** `applyExpansionResistance`
   - **Reads:** energy, degree
   - **Writes:** velocity (`vx/vy`)
   - **Source:** `src/physics/engine/degrees.ts`

9) **Constraint Accumulation (position correction requests)**
   - **Pass:** `initializeCorrectionAccum`
   - **Reads/Writes:** correction accumulators
   - **Source:** `src/physics/engine/constraints.ts`

10) **Edge Relaxation (post-solve shape nudge)**
    - **Pass:** `applyEdgeRelaxation`
    - **Reads:** positions, degrees, link rest length
    - **Writes:** **correction accumulator**
    - **Source:** `src/physics/engine/constraints.ts`

11) **Spacing Constraints (soft/hard zones)**
    - **Pass:** `applySpacingConstraints`
    - **Reads:** positions, degrees, energy, escape window
    - **Writes:** **correction accumulator**
    - **Source:** `src/physics/engine/constraints.ts`

12) **Triangle Area Constraints**
    - **Pass:** `applyTriangleAreaConstraints`
    - **Reads:** positions, degree, energy
    - **Writes:** **correction accumulator**
    - **Source:** `src/physics/engine/constraints.ts`

13) **Angle Resistance**
    - **Pass:** `applyAngleResistance`
    - **Reads:** positions, degree, energy, escape window
    - **Writes:** **velocity (`vx/vy`)** + local damping
    - **Source:** `src/physics/engine/constraints.ts`

14) **Distance Field Bias + Hard Clamp**
    - **Pass:** `applyDistanceFieldBias`
    - **Reads:** positions, degree, energy, clamp hysteresis
    - **Writes:** **velocity (`vx/vy`)** and **correction accumulator**
    - **Source:** `src/physics/engine/constraints.ts`

15) **Final Corrections (position write)**
    - **Pass:** `applyCorrectionsWithDiffusion`
    - **Reads:** correction accumulator, degrees
    - **Writes:** **positions (`x/y`)**
    - **Source:** `src/physics/engine/corrections.ts`

16) **Energy Debug Log**
    - **Pass:** `logEnergyDebug`
    - **Writes:** console log
    - **Source:** `src/physics/engine/debug.ts`

---

### Which passes write positions directly?
- **Pre-roll phase**: integrates `x/y` directly (and returns early).  
  `runPreRollPhase` (`src/physics/engine/preRollPhase.ts`)
- **Integration**: `integrateNodes` advances `x/y` from velocity.  
  `src/physics/engine/integration.ts`
- **Corrections**: `applyCorrectionsWithDiffusion` writes `x/y` corrections after constraints.  
  `src/physics/engine/corrections.ts`
- **Note:** Some forces (springs, repulsion, collision) only write `fx/fy`, but angle and distance bias write velocity directly.

---

## 2) Tunables (config + inline constants)

### Config defaults
**Source:** `src/physics/config.ts`

#### Core Force Knobs
- `repulsionStrength = 500`
- `repulsionDistanceMax = 60`
- `springStiffness = 0.2`
- `springLength = 500` (deprecated)
- `targetSpacing = 375`
- `initScale = 0.1`
- `snapImpulseScale = 0.4`
- `boundaryMargin = 50`
- `boundaryStrength = 50`
- `collisionStrength = 2000`
- `collisionPadding = 8`

#### Damping / Energy
- `damping = 0.90`
- `maxVelocity = 80`
- `velocitySleepThreshold = 0.1`
- `formingTime = 2.0`
- `restForceScale = 0.05`
- `equilibriumCaptureTime = 600`
- `radialDamping = 0.95`
- `tangentDamping = 0.3`
- `spinDamping = 0.5`
- `spinBlend = 0.15`

#### Topology / Constraints
- `linkRestLength = 130`
- `springDeadZone = 0.15`
- `minNodeDistance = 100`
- `softRepulsionStrength = 5`
- `minEdgeAngle = π/6`
- `softDistanceMultiplier = 1.5`
- `softRepulsionExponent = 2.5`
- `softMaxCorrectionPx = 2.0`
- `maxCorrectionPerFrame = 1.5`
- `hardSoftnessBand = 0.2`
- `clampHysteresisMargin = 25`
- `maxNodeCorrectionPerFrame = 0.5`
- `contactSlop = 12`
- `expansionResistance = 0.15`

### Inline constants (hard-coded per pass)
- Pre-roll: carrier omega `0.03`, bias strengths `0.3/0.5`, pre-roll max speed `8.0`  
  `src/physics/engine/preRollPhase.ts`
- Angle resistance zones + force strength `25.0`  
  `src/physics/engine/constraints.ts`
- Distance field bias strength `15.0`, emergency correction `0.3`, penetration > 5  
  `src/physics/engine/constraints.ts`
- Integration: hub inertia massFactor `0.4`, carrier strength `0.05`, damping and clamp logic  
  `src/physics/engine/integration.ts`

---

## 3) Overlap & Override Diagnosis (symptom → causes → why → how to measure)

| Symptom | Passes involved | Why (math/logic) | How to measure |
|---|---|---|---|
| **Min distance feels “untunable”** | `applyCollision` (force), `applySpacingConstraints` (position corrections), `applyDistanceFieldBias` (velocity + clamp), plus pre-roll spacing (velocity) | Multiple channels enforce the same rule: collision adds force, spacing adds post-solve position correction, distance-field adds velocity bias + emergency positional clamp. These channels can *stack* or *fight* depending on timing and energy gating. | Track per-pass totals: net force magnitude from collision vs total correction from spacing vs bias velocity from distance field per frame; measure clamp hits and average penetration depth. |
| **Hub expansion won’t respond to spring tuning** | `applySprings` (hub softening), `applyExpansionResistance`, integration hub inertia + damping + max velocity clamp, correction hub inertia | Springs are weakened for high-degree nodes during early energy (`applySprings`), then velocities damped by `applyExpansionResistance`, then inertia + damping in `integrateNodes`, then corrections are slowed by hub inertia in `applyCorrectionsWithDiffusion`. Net effect: spring changes are throttled in multiple places. | Log per-node energy-scaled spring force vs actual velocity delta for hubs, plus correction budget consumed. |
| **Angles don’t stay open (or snap closed)** | `applyAngleResistance` (velocity), `applyTriangleAreaConstraints` (position), springs (force) | Angle resistance is velocity-only (and phase-gated). Triangle area constraints push vertices (pos). Springs then pull edges back toward rest length—these can pull in opposite directions. | Compare per-frame angle resistance velocity delta vs triangle correction magnitude on same nodes. |
| **“Safety” clamps dominate late-stage motion** | Distance-field bias + emergency corrections (`applyDistanceFieldBias`) + correction diffusion | Hard clamp triggers when penetration > 5; once clamped, hysteresis keeps it active. That can become the main driver if other passes cause min distance violations repeatedly. | Measure `clampedPairs` size over time + average penetration depth and clamp correction totals. |
| **Behavior changes at phase boundaries feel like pops** | Energy gating in spacing & angle resistance + energy-scaled force pass | Spacing constraints only when `energy <= 0.7`, angle resistance is gated for zones during expansion, while force scale and damping change continuously (energy envelope). When constraints engage, accumulated violations are corrected suddenly. | Graph per-pass correction totals versus energy; count sudden jumps at energy 0.7. |
| **Symmetry breakers fight organic drift** | Pre-roll carrier drift + integration carrier flow + directional persistence filtering | Multiple symmetry-breakers (pre-roll drift, carrier flow, and force filtering) can pull in different directions; filtering spring forces can oppose other force contributions or angle constraints. | Log velocity delta per pass attributed to carrier flow vs force filtering; report nodes entering escape window frequently. |

---

## 4) Proposed “Sharp Engine” Pipeline (ordered + channel rules)

### Guiding rules
- **One writer rule:** Only one stage writes final positions each frame (projection at end).
- **Strict channels:**
  - **Force channel:** accumulate `fx/fy`
  - **Velocity channel:** `dv` shaping (no position writes)
  - **Constraint channel:** position projection requests only
  - **Safety channel:** rare, deep penetration only
- **Topology roles:** separate handling for leaves (deg=1), hubs (deg≥3), faces (triangles).
- **Budgets:** per-node correction budget and per-constraint priority.

### Proposed Ordered Pipeline (incremental replacement)

1) **Phase/State Update**
   - Reads lifecycle, sets `energy`, phase labels.
   - **Writes:** phase flags only.
   - *No force/vel/pos writes.*
   - **Anchor:** `computeEnergyEnvelope` in `src/physics/engine/energy.ts`.

2) **Force Channel: Core Forces**
   - Apply springs, repulsion, boundary, collisions (but **only** as forces).
   - **Writes:** `fx/fy` only.
   - **No velocity or position writes.**
   - **Anchor:** `applyForcePass` + `forces.ts`.

3) **Velocity Channel: Topology Shaping**
   - Carrier drift / symmetry breaking / hub inertia **only here**.
   - **Writes:** velocity (`vx/vy`) only.
   - **No direct force or position corrections.**
   - **Anchor:** currently split between `preRollPhase.ts` and `integration.ts`.

4) **Integrate**
   - Integrate `fx/fy` → `vx/vy`, apply global damping, clamp velocity.
   - **Writes:** velocity + positions (intermediate).
   - **Anchor:** `integrateNodes`.

5) **Constraint Channel: Geometry**
   - **Only position correction requests** (accumulator).
   - Ordered:
     1. *Primary* constraint (one owner per behavior):
        - spacing (min dist) **or** collision, not both
     2. angle / triangle
     3. edge relax
   - **Writes:** correction accumulator only.
   - **Anchor:** `constraints.ts` + `corrections.ts`.

6) **Projection / Final Position Writer**
   - Apply correction budget + priority ordering + single diffusion pass.
   - **Writes:** final `x/y`.
   - **Anchor:** `applyCorrectionsWithDiffusion`.

7) **Safety Channel (rare)**
   - Runs last; only if deep penetration.
   - **Writes:** position clamp (rare), and logs.
   - **Anchor:** currently embedded in `applyDistanceFieldBias`.

### Why this removes dilution
- Each behavior has **one owner** and one channel.
- Position corrections don’t compete with velocity shaping.
- Safety clamps are last-resort, not “every frame.”
- Each tuning knob maps to a single pass with a single metric.

---

## 5) Tuning Knobs (clean semantics + metrics)

### Spacing / Personal Space (unconnected vs connected)
- **Controls:** min distance + collision padding + soft zone width only.
- **Metric:** “% of node pairs below `minNodeDistance`”, average penetration depth, clamp rate.
- **Logs:** spacing correction total, collision force total, clamp hits.
- **Current knobs:** `minNodeDistance`, `collisionPadding`, `softDistanceMultiplier`, `softMaxCorrectionPx`, `contactSlop`.

### Spring Rest Length
- **Controls:** connected-node rest distance only.
- **Metric:** average link error (|d - rest|), variance.
- **Logs:** per-frame spring force total, link error histogram.
- **Current knobs:** `linkRestLength`, `springDeadZone`, `springStiffness`.

### Hub Freedom during Expansion
- **Controls:** hub inertia / softening only.
- **Metric:** average hub velocity vs leaf velocity early-phase.
- **Logs:** per-degree velocity delta (hub vs non-hub), hub-only correction totals.
- **Current knobs:** `expansionResistance`, hub softening in springs and integration (inline constants).

### Angle Minimum & Resistance Curve
- **Controls:** minimum allowable angle, resistance curve only.
- **Metric:** distribution of edge angles; percent below thresholds.
- **Logs:** count of angle constraints applied by zone, total tangential impulse.
- **Current knobs:** zone thresholds and `angleForceStrength` in `constraints.ts`.

### Damping & Energy Schedule
- **Controls:** time-scale for motion + settle.
- **Metric:** total kinetic energy curve vs time; time to settle.
- **Logs:** per-frame effective damping, avg velocity magnitude.
- **Current knobs:** `spinDamping`, energy envelope in `energy.ts`, damping in integration.

### Safety Penetration Limit
- **Controls:** when emergency clamp triggers, not regular spacing.
- **Metric:** clamp rate, max penetration depth.
- **Logs:** number of emergency corrections applied.
- **Current knobs:** `clampHysteresisMargin`, penetration threshold in `applyDistanceFieldBias`.

---

## 6) Instrumentation Plan (no console spam)

### Where to hook
- Introduce a **per-frame debug stats accumulator**:
  - New struct in `src/physics/engine/debug.ts` (or new `engine/stats.ts`), toggled by a `config.debugStats` flag (not present yet).
  - Collected by each pass via a shared object passed down from `tick()` in `src/physics/engine.ts`.

### What to collect
**Per-pass totals (per frame):**
- **Force total**: sum of |F| added per pass
- **Velocity delta**: sum of |Δv| per pass
- **Position correction**: sum of |Δx| per pass
- **Nodes affected**: count per pass

**Top offenders:**
- **Top 5 nodes by correction magnitude** (after budget clamp)
- **Top 5 constraints by correction size** (e.g., spacing, angle, triangle)

**Safety metrics:**
- **Clamp trigger count** (per frame + rolling average)
- **Slop zone entry count**
- **Average penetration depth**

### How to surface
- In `GraphPhysicsPlayground.tsx`, render a **collapsed debug panel** that reads stats from engine (exposed via getter).

---

## 7) Minimal Incremental Refactor Plan (preserve behavior)

### Step 1: Add instrumentation (no behavior change)
- Add a `DebugStats` type in `src/physics/engine/debug.ts` or a new `src/physics/engine/stats.ts`.
- Update `PhysicsEngine.tick()` in `src/physics/engine.ts` to create a stats object per frame and pass it to each pass.
- In each pass file (`forcePass.ts`, `integration.ts`, `constraints.ts`, `corrections.ts`, `preRollPhase.ts`), accumulate totals (force, dv, corrections, affected nodes) into `DebugStats`.
- Add a getter on `PhysicsEngine` to retrieve stats so UI can consume it later (no UI changes yet).

### Step 2: Enforce channel ownership
- Create a new `engine/velocityPass.ts` that hosts carrier drift, symmetry breaking, and directional persistence (move code from `preRollPhase.ts` and `integration.ts`).
- Ensure `velocityPass` only writes `vx/vy` and never touches positions or forces.
- Remove duplicated velocity adjustments from `preRollPhase` once they are handled by `velocityPass`.
- Keep behavior identical by preserving constants and gates while only changing location.

### Step 3: Reduce safety dominance
- In `constraints.ts`, split `applyDistanceFieldBias` into:
  - `applyDistanceFieldBiasVelocity` (velocity-only)
  - `applySafetyClamp` (position correction only)
- Ensure `applySafetyClamp` only runs if penetration > deep threshold and is **last** in the constraint pipeline.
- Add instrumentation counts for clamp hits and penetration depth to validate reduction.

### Step 4: Reintroduce constraints with priority
- Decide single owner for spacing vs collision (e.g., collision stays force-only; spacing is the sole constraint).
- In `engine.ts`, order constraint passes as: spacing → triangle → angle → edge relax (or similar).
- Update `applyCorrectionsWithDiffusion` to respect per-constraint priority (e.g., tag accumulators by source).
- Verify via instrumentation that total corrections per behavior are isolated and predictable.

---

## Goal
After this plan, we should be able to pick ONE behavior (e.g., “center hub fungus clump”) and know exactly which pass controls it. Tuning it should not be overridden by 10 other forces.
