# Arnvoid Physics Unification - Forensic Scandissect

Date: 2026-01-31
Scope: src/physics/*, src/playground/rendering/*, src/playground/GraphPhysicsPlayground.tsx
Goal: Map fragmentation sources and quantify why Dot movement feel diverges across scale.

## Assumptions and Limits
- No manual runtime sampling executed in this pass; instrumentation is added for you to run locally.
- I treat "early expansion" gates as a separate law tier because they are hard cutoffs (energy thresholds).
- I assume the scale harness should be dev-only UI (Sidebar controls) rather than a CLI script.

## Evidence Index (Selected Files)
- src/physics/engine/engineTick.ts:100,261,283,307,332,378,391,496,526,551,597,689
- src/playground/rendering/graphRenderingLoop.ts:557,585,598,644,665,671,682,721
- src/physics/config.ts:116,118,124,134,136,137,138,144-149,153,161-166
- src/physics/engine/energy.ts:11-30
- src/physics/engine/integration.ts:62-104,108-168,193-222
- src/physics/forces.ts:28-29,84-88,288-333,344-451
- src/physics/engine/constraints.ts:40-107,136-210,401-405,468-493
- src/physics/engine/corrections.ts:20-26,61-155,167-252
- src/physics/engine/velocity/*.ts (see behavior inventory)
- src/physics/engine/feelMetrics.ts:109-229 (new instrumentation)
- src/playground/GraphPhysicsPlayground.tsx:361-372
- src/playground/components/SidebarControls.tsx:78-90

## File Map (Movement + Hover + Drag + Camera)

### src/physics/*
| File | Ownership / Law Encoded |
| --- | --- |
| src/physics/types.ts | Dot/link schema that every pass assumes. |
| src/physics/config.ts | Global constants and thresholds (magic numbers) controlling scale behavior. |
| src/physics/engine.ts | State container: drag authority, sleeping, warm-start reset, topology caps. |
| src/physics/forces.ts | Soft forces: repulsion, collisions, springs, center gravity, boundary. |
| src/physics/engine/engineTick.ts | Pass order, perf mode, gating, spacing cadence, constraints pipeline. |
| src/physics/engine/energy.ts | Energy envelope (force scale, damping, max velocity). |
| src/physics/engine/integration.ts | Integration order, hub inertia, dt skew, damping, sleep. |
| src/physics/engine/forcePass.ts | Pre-roll topology softening + force pass orchestration. |
| src/physics/engine/constraints.ts | Spacing, triangle area, safety clamp, edge relaxation. |
| src/physics/engine/corrections.ts | Correction diffusion + residual debt handling. |
| src/physics/engine/impulse.ts | One-shot kick at birth, role-based weights. |
| src/physics/engine/preRollPhase.ts | Pre-roll phase timer. |
| src/physics/engine/escapeWindow.ts | Short-term constraint bypass for trapped Dots. |
| src/physics/engine/degrees.ts | Degree cache for hub logic. |
| src/physics/engine/engineTime.ts | Time source utility. |
| src/physics/engine/stats.ts | Pass stats (forces/vel/corrections). |
| src/physics/engine/feelMetrics.ts | New dev-only scale metrics instrumentation. |
| src/physics/engine/velocityPass.ts | Aggregates velocity modifiers. |
| src/physics/engine/velocity/dragVelocity.ts | Kinematic drag authority. |
| src/physics/engine/velocity/preRollVelocity.ts | Pre-roll separation + carrier drift. |
| src/physics/engine/velocity/expansionResistance.ts | Degree-based damping in expansion. |
| src/physics/engine/velocity/hubVelocityScaling.ts | Hub velocity scaling (density bypass). |
| src/physics/engine/velocity/angleResistance.ts | Angular min-angle resistance gates. |
| src/physics/engine/velocity/distanceBias.ts | Velocity-only bias near spacing clamp. |
| src/physics/engine/velocity/denseCoreVelocityUnlock.ts | Dense core micro-slip (de-locking). |
| src/physics/engine/velocity/staticFrictionBypass.ts | Zero-velocity micro-shear unlock. |
| src/physics/engine/velocity/angularVelocityDecoherence.ts | Micro vorticity seed. |
| src/physics/engine/velocity/localPhaseDiffusion.ts | Phase decorrelation. |
| src/physics/engine/velocity/edgeShearStagnationEscape.ts | Pairwise perpendicular shear to break jams. |
| src/physics/engine/velocity/denseCoreInertiaRelaxation.ts | Momentum memory eraser. |
| src/physics/engine/velocity/carrierFlow.ts | Hub carrier drift + spring filtering. |
| src/physics/engine/velocity/damping.ts | Main damping law. |
| src/physics/engine/velocity/baseIntegration.ts | Base v integration + clamp. |
| src/physics/engine/velocity/energyGates.ts | Early expansion and density helpers. |
| src/physics/engine/velocity/relativeVelocityUtils.ts | Shared math for velocity passes. |
| src/physics/engine/velocity/lowForceStagnationEscape.ts | Low-force drift (alternate stagnation escape). |
| src/physics/engine/velocity/debugVelocity.ts | Debug logging for velocity passes. |
| src/physics/test-physics.ts | Test harness (not currently wired). |

### src/playground/rendering/*
| File | Ownership / Law Encoded |
| --- | --- |
| src/playground/rendering/graphRenderingLoop.ts | Scheduler, overload, degrade cadence, rAF timing. |
| src/playground/rendering/hoverController.ts | Hover selection, hit testing, pointer sampling. |
| src/playground/rendering/hoverEnergy.ts | Hover energy smoothing (interaction feel). |
| src/playground/rendering/camera.ts | Camera transform (world/screen mapping). |
| src/playground/rendering/renderingMath.ts | Quantization and smoothing math. |
| src/playground/rendering/metrics.ts | UI metrics sample (avg speed, fps). |
| src/playground/rendering/graphDraw.ts | Draw order (hover Z-truth). |
| src/playground/rendering/renderGuard.ts | Render safety guards. |
| src/playground/rendering/renderScratch.ts | Scratch buffers and hit grid. |
| src/playground/rendering/spatialGrid.ts | Spatial grid for hover selection. |
| src/playground/rendering/renderingTypes.ts | Render state and settings. |
| src/playground/rendering/gradientCache.ts | Cached paint assets. |
| src/playground/rendering/canvasUtils.ts | Canvas helpers. |
| src/playground/rendering/debugUtils.ts | Debug visuals. |
| src/playground/rendering/textCache.ts | Text caching for labels. |

## Behavior Inventory (Core)

| Behavior | Location (file:line, function) | Trigger Condition | Effect on Motion | Scale Sensitivity | Conflicts | Intended Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| Perf mode switching | src/physics/engine/engineTick.ts:100-165 updatePerfMode + src/physics/config.ts:161-166 | node/link count thresholds | Switches perfMode (normal/stressed/emergency/fatal) and budget scales | Hard thresholds at N=250/500/900 and E=1200/2000/3000 | Alters pass cadence vs constraints; changes "law" by scale | Keep frame budget stable |
| Scheduler degrade + debt drop | src/playground/rendering/graphRenderingLoop.ts:557-721 runPhysicsScheduler | budget exceeded, max steps hit, debt watchdog | Skips steps and drops accumulated time | Large N hits budget more often | Breaks continuity with fixed-step pipeline | 60fps priority, no syrup |
| Spacing gate + cadence | src/physics/engine/engineTick.ts:341-384 | energy gate + perfMode + degrade | Spacing constraint runs intermittently, stride increases | Energy gate + stride makes dense graphs weaker/laggy | Competes with repulsion/velocity bias | Reduce O(N^2) work |
| Pair stride scaling | src/physics/engine/engineTick.ts:332-372 | budget scale + pairwiseMaxChecks | Pairwise forces/constraints skip pairs | Stride grows with N (lower coverage) | Hot pairs can miss forces | Bound work per frame |
| Pre-roll phase | src/physics/engine/engineTick.ts:283-292 + src/physics/engine/forcePass.ts:41-170 + src/physics/engine/velocity/preRollVelocity.ts:11-71 | first 5 frames pre-roll | Springs at 10%, hub softening, velocity-only separation + carrier drift | Fixed frame count regardless of N | Can fight later expansion rules | Break initial symmetry gently |
| Impulse kick | src/physics/engine/impulse.ts:3-74 | lifecycle < 0.1s, once | Injects velocity based on link spacing + role weights | Larger graphs w/ more links accumulate more impulse | Can overshoot, later damped | Rapid unfolding |
| Energy envelope | src/physics/engine/energy.ts:11-30 | lifecycle decay | Force scale, damping, max velocity all decay over time | Time-only but large graphs take longer to settle | Interacts with early-expansion gates | Controlled cooldown |
| Early-expansion dense repulsion | src/physics/forces.ts:28-122 | energy > 0.85 + densityRadius=25 + density>=4 | Boosts repulsion by density and distance | Dense clusters appear only at higher N | Competes with spacing/constraints | Push out dense cores |
| Hub spring softening + tangential softening + dither | src/physics/forces.ts:288-484 | energy > 0.8/0.85 + degree>=3 + density | Weakens springs for hubs, reduces tangential component, adds dither | Degree distribution varies with N | Can fight constraints and angle resistance | Prevent lockups + allow shear |
| Integration priority + dt skew | src/physics/engine/integration.ts:62-168 | energy > 0.85 | Hash-ordered integration, optional dt skew | More Dots = more order effects | Conflicts with PBD corrections | Break symmetry early |
| Hub inertia + force low-pass | src/physics/engine/integration.ts:98-136 | degree>=3 + energy>0.8 | Heavier mass + force lag for hubs | More hubs at higher N | Can lag behind constraints | Stabilize hub overshoot |
| Expansion resistance | src/physics/engine/velocity/expansionResistance.ts:13-113 | energy>0.7, degree>=2 | Damps hub velocity, bypasses dense hubs early | Density gate hits more at high N | Competes with hub scaling, damping | Prevent explosive expansion |
| Angle resistance | src/physics/engine/velocity/angleResistance.ts:18-147 | min-angle thresholds, energy>0.7 | Adds tangential push + damping, mostly disabled during expansion | High degree amplifies at higher N | Fights springs/spacing | Maintain edge angle hygiene |
| Distance bias velocity | src/physics/engine/velocity/distanceBias.ts:14-165 | minNodeDistance + contactSlop | Projects inward velocity, adds outward bias | Fixed px thresholds; more overlaps at high N | Fights spacing + repulsion | Prevent "invisible wall" bounce |
| Static friction bypass | src/physics/engine/velocity/staticFrictionBypass.ts:21-98 | energy>0.85, density>=4, relVel<0.05 | Adds micro shear to linked pairs | Dense condition rare at small N | Can fight hand if misgated | Break static locks |
| Edge shear stagnation escape | src/physics/engine/velocity/edgeShearStagnationEscape.ts:37-131 | energy>0.85, dense, restEps=5, velEps=0.3 | Perpendicular shear on near-rest links | Dense gate hits larger N | Can counter spring alignment | Unjam near-rest pairs |
| Dense core inertia relaxation | src/physics/engine/velocity/denseCoreInertiaRelaxation.ts:36-111 | energy>0.85, density>=4, low speed/force | Reorients velocity toward neighborhood flow | Dense gate ties to N | Can counter damping | Remove momentum memory |
| Corrections diffusion + residuals | src/physics/engine/corrections.ts:20-252 | per-node correction budget + diffusion gate | Diffuses corrections, stores residual debt | Degree scaling affects high N more | Competes with constraints/drag | Prevent pressure concentration |
| Hand authority + constraint softening | src/physics/engine/velocity/dragVelocity.ts:11-25 + src/physics/engine.ts:421-499 + src/physics/engine/constraints.ts:77-82 | drag active | Direct position override; constraints softened near hand | In dense graphs, neighbors still push | Diffusion adds lateral drift | Knife-sharp drag feel |
| Rest mode (solver coma) | src/physics/engine/engineTick.ts:261-279 | idleFrames > 60 | Hard skip physics; zero forces/velocities | Larger N less likely to be fully idle | Can hide low-level jitter | True dead rest |

## Known Fracture Zones (Verified)

1) Mode-switching schisms
- perfMode thresholds hard switch laws based on N/E (src/physics/config.ts:161-166; src/physics/engine/engineTick.ts:100-165).
- perfMode affects spacing cadence and spring enablement (src/physics/engine/engineTick.ts:378-389).
- Result: 5 vs 60 vs 500 Dots experience different laws (frequency, pair stride, triangle pass).

2) Magic numbers that do not scale
- Density radii fixed at 25-30 px (src/physics/forces.ts:29; src/physics/engine/velocity/*.ts:31-43).
- restEps=5, velEps=0.3, forceEps=0.8, microSlip=0.01 (src/physics/engine/velocity/edgeShearStagnationEscape.ts:44-47; src/physics/engine/velocity/staticFrictionBypass.ts:32-33).
- minNodeDistance=100, contactSlop=12, clampHysteresisMargin=25 (src/physics/config.ts:124,136,138) are absolute distances.
- Result: same literal pixels yield different "feel" as density and scale change.

3) Velocity patch stack (order-sensitive)
- Micro passes gated by microEvery and energy (src/physics/engine/engineTick.ts:565-586).
- Many modifiers run after integration: expansion resistance, de-locking, static friction bypass, decoherence, phase diffusion, shear escape, inertia relax (same block).
- Order makes some effects cancel others (e.g., a shear kick damped by expansion resistance or hub scaling).

4) Forces vs constraints fighting in one frame
- Force pass then integration then PBD constraints + safety clamp + diffusion (src/physics/engine/engineTick.ts:526-689).
- Example: repulsion and springs push, then spacing and safety clamp pull back, then corrections diffuse.
- Result: "push then snap" adds micro jitter and requires extra damping patches.

5) Early-phase privilege gates
- Energy > 0.85 gates multiple passes (repulsion density boost, hub softening, micro-slip, shear escape, inertia relaxation) across files (src/physics/forces.ts:28; src/physics/engine/velocity/*.ts:36-45).
- Result: physics law differs in the first ~0.3-0.6s vs later.

6) Hand/drag special casing scattered
- Kinematic drag override in dragVelocity (src/physics/engine/velocity/dragVelocity.ts:19).
- isFixed + release logic in engine (src/physics/engine.ts:421-499).
- Constraint softening near hand in EdgeRelaxation (src/physics/engine/constraints.ts:77-82).
- Diffusion damping near hand in corrections (src/physics/engine/corrections.ts:240-252).
- Result: hand authority is implemented in multiple layers rather than a single unified priority field.

## Tick Timeline (Per Frame)

Order (engine tick):
1) updatePerfMode + gating (engineTick:100-384)
2) Pre-roll (engineTick:283-292) if active
3) Force pass (repulsion/collision/springs) (engineTick:526; forcePass.ts)
4) Drag velocity override + pre-roll velocity (engineTick:551-552)
5) Integration (engineTick:555; integration.ts)
6) Expansion resistance (engineTick:560; expansionResistance.ts)
7) Micro passes (de-locking, static friction bypass, decoherence, phase diffusion, shear escape, inertia relax) (engineTick:565-586)
8) PBD/constraints: edge relax -> spacing -> triangle area -> angle resistance -> distance bias -> safety clamp (engineTick:597-675)
9) Corrections with diffusion (engineTick:689; corrections.ts)

Scale-based branches:
- perfMode (normal/stressed/emergency/fatal) affects spacing and spring cadence (engineTick:378-389).
- degradeLevel gates pass frequency (engineTick:383-394).
- spacingGate energy threshold enables/disables spacing (engineTick:341-361).
- triangle area disabled when perfMode >= emergency (engineTick:654).
- pair stride scaled by budget scale (engineTick:332-372).

## Fragmentation Map (Sources -> Effects)

| Fragment Source | Trigger | Where | Scale Sensitivity | Net Effect |
| --- | --- | --- | --- | --- |
| perfMode thresholds | N/E count | engineTick + config | High: binary at N=250/500/900 | Law switch (frequency, triangle pass) |
| Degrade scheduling | budget, steps, debt | graphRenderingLoop.ts | High: more likely at large N | Pass skipping + debt drop |
| Energy gates | energy > 0.85 / > 0.7 | forces + velocity + constraints | Medium: time-based, but larger N takes longer | Two separate "laws" (early vs late) |
| Density gates | neighbor count >= 4, radius 25-30px | forces + velocity | High: only large N produces dense cores | Extra micro-slip and repulsion boost |
| Degree gates | degree >= 3 | integration + velocity + springs | Medium: degree distribution changes with N | Hub inertia and bypass behaviors |
| Absolute px thresholds | minDist=100, restEps=5, velEps=0.3 | config + velocity | High: fixed px at different scale | Sensitivity mismatch across N |
| Pass order | fixed ordering | engineTick | Medium: higher N increases conflicts | Forces vs constraints vs diffusion |
| Hand special cases | drag active | dragVelocity + constraints + corrections | Medium: drag region size varies with density | Drag feel diverges per N |

## Conflict Graph (Text)

Repulsion/Springs
  -> Integration
    -> Spacing/SafetyClamp
      -> Corrections+Diffusion
        -> DistanceBiasVelocity

AngleResistance / HubSoftening / ExpansionResistance
  -> (re-shapes velocity after integration)
  -> can counteract earlier forces or constraints in the same frame

DragVelocity (kinematic)
  -> Constraints (softened near hand)
    -> Corrections (diffusion damped near hand)

## Conflict Matrix (Who Fights Who)

| A | B | Conflict Mechanism | Order |
| --- | --- | --- | --- |
| Repulsion | Spacing/SafetyClamp | Force pushes apart, PBD pulls back | Force then constraints |
| Springs | DistanceBiasVelocity | Spring forces vs velocity projection away from minDist | Integration then velocity bias |
| Hub softening | Triangle/Angle constraints | Hubs skip or soften some constraints | Constraints later in frame |
| Expansion resistance | Micro-slip passes | Damping can kill micro kicks | After integration, before constraints |
| Corrections diffusion | Hand drag | Diffusion can move neighbors sideways near hand | After constraints |
| Perf/degrade cadence | Spacing/hot pairs | Skipped frames alter spacing continuity | Mixed cadence |

## Fragmentation Sources Ranked (Top 10)

1) perfMode thresholds change core laws at N=250/500/900 (src/physics/config.ts:161-166; src/physics/engine/engineTick.ts:100-165).
2) Degrade scheduling drops time and skips passes under load (src/playground/rendering/graphRenderingLoop.ts:557-721).
3) Energy gates (early expansion) enable entire bundles of behaviors (src/physics/forces.ts:28; src/physics/engine/velocity/*.ts:36-45).
4) Density gates + fixed radii (25-30px) decide who gets micro-slip (src/physics/forces.ts:29; src/physics/engine/velocity/*.ts:31-43).
5) Velocity patch stack order (engineTick.ts:565-586) causes cancels and phase drift.
6) Mixed soft vs hard correction pipeline (engineTick.ts:597-689) causes push/pull oscillation.
7) Hub-specific inertia and softening (integration.ts:98-136; forces.ts:288-333) diverges behavior by degree.
8) Pair stride scaling and spacing cadence changes with budget (engineTick.ts:332-384) cause uneven coverage.
9) Hand privileges distributed across multiple layers (engine.ts:421-499; constraints.ts:77-82; corrections.ts:240-252).
10) Pre-roll and impulse one-shot behaviors (forcePass.ts:41-170; impulse.ts:3-74) introduce a unique startup law.

## Keepers (Must Preserve)
- Stagnation escape and perpendicular slip (edgeShearStagnationEscape.ts:37-131).
- Dense core inertia relaxation (denseCoreInertiaRelaxation.ts:36-111).
- Hub anchoring behavior (integration.ts:98-136; hubVelocityScaling.ts:12-45).
- Hand authority (dragVelocity.ts:19; engine.ts:421-499).
- Spacing hot pairs fairness (constraints.ts:218-273).

## Unification Strategy (Forensic, Not a Refactor Yet)

1) Replace binary gates with continuous scalars
- perfMode -> budgetScale 0..1, used only to reduce sampling, not to change force laws.
- energy gates -> temperature scalar shared by all behaviors (no >0.85 hard cutoff).

2) Normalize distances
- Convert fixed radii (25-30px, restEps=5) into relative units based on Dot radius or targetSpacing.
- Define a single "interaction length" for density, spacing, and micro-slip.

3) Collapse hand privilege into a single field
- Define per-Dot "priority" or "authority" that all passes consult once (force, constraints, diffusion).

4) Remove pass-order conflicts via unified correction budget
- Use a single constraint/force accumulator with bounded budget, avoid back-and-forth between force and clamp.

5) Keep feel identical across degrade
- Degrade should only reduce coverage, never change equations or stiffness.

## Metrics and Scale Harness (New)

Instrumentation (dev-only, gated by config.debugPerf):
- src/physics/engine/feelMetrics.ts:109-229 adds `[PhysicsScale]` logs:
  - time-to-settle (avg speed < epsilon for 30 frames)
  - overshootMax (max spring stretch beyond rest)
  - micro jitter average (avg speed while settled)
  - correction residual sum/max + delta
  - avg correction per frame
  - degrade distribution + pass skip counts

Scale harness (dev-only UI):
- Sidebar quick buttons for N=5/20/60/250/500 (src/playground/components/SidebarControls.tsx:78-90).
- Immediate spawn with new seed (src/playground/GraphPhysicsPlayground.tsx:361-372).

Suggested run:
1) Set config.debugPerf=true in `src/physics/config.ts`.
2) Use Scale Harness buttons for N=5, 20, 60.
3) Capture `[PhysicsScale]` logs for 10s each.
4) Compare: settleMs, jitterAvg, overshootMax, residualSum, and skip counts.

## Single-Law Target (Feel Contract)

What unified law should feel like:
- Same springiness, damping, and recovery curve regardless of Dot count.
- Dense cores shear and unwind smoothly, never freeze or buzz.
- Dragged Dot is always 1:1; nearby Dots respond smoothly without tug-of-war.
- Settle is decisive (no crawl), yet retains a tiny organic residual only if energy > 0.

Must never happen:
- "Mud" (slow-motion feel) under load.
- Early-phase "pop" where the law suddenly changes.
- Triangle collapse or edge angle chatter at high N.
- Drag-induced neighbor slosh or delayed catch-up.

-- End of forensic report --
