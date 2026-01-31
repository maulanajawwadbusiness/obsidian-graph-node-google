# Physics Unification Run 3 Report

Date: 2026-01-31

## Scope (Run 3: Steps 7–9)
This run normalizes remaining pixel-level constants into scale-safe units, adds a dev-only scale harness for proof metrics, and consolidates motion law into a single MotionPolicy module.

## 7) Constant Normalization (Scale-Safe Units)
The following constants were normalized to min-distance / velocity scale rather than raw pixels:

| Constant | Old Value | New Formula | Reason |
| --- | --- | --- | --- |
| densityRadius | `30` | `minNodeDistance * 0.3` | Scale local density probes to spacing. |
| densityThreshold | `4` | `max(2, round(minNodeDistance / 25))` | Maintain neighbor count at different spacing scales. |
| minSpeed (angular decoherence) | `0.1` | `max(0.08, maxVelocity * 0.0015)` | Normalize near-stationary guard to max velocity. |
| velEps (stuckness) | `0.5` | `max(0.3, maxVelocity * 0.006)` | Scale stuck detection with velocity envelope. |
| forceEps (stuckness) | `0.8` | `max(0.2, springStiffness * targetSpacing * 0.005)` | Tie force epsilon to spring scale. |
| restEps | `5.0` | `minNodeDistance * 0.05` | Normalize rest-length tolerance to spacing. |
| microSlip | `0.03` | `minNodeDistance * 0.0003` | Keep micro-slip proportional to spacing. |
| microSlip (static friction) | `0.01` | `microSlip * 0.33` | Match legacy strength on normalized scale. |
| carrierStrength | `0.05` | `microSlip * 1.6` | Normalize carrier bias to spacing. |
| centroidEpsilon | `2.0` | `distanceEpsilon * 20` | Normalize centroid reliability guard. |
| breakVelocity | `3.0` | `stuckSpeedEpsilon * 6` | Keep persistence exit tied to velocity scale. |

## 8) Scale Harness + Truth Metrics
**Module**: `src/physics/engine/scaleHarness.ts`

**How to run (dev-only)**
1) Enable debug perf in the physics config.
2) In the browser console, set:
   ```js
   window.__PHYSICS_SCALE_HARNESS__ = true
   ```
3) The harness runs once on the next tick and logs a summary table.

**Metrics captured**
- `settleMs`
- `overshootMax`
- `jitterAvg` at rest
- `pbdCorrectionAvg` per frame
- `% corrOppose` (corrections opposing velocity)
- `energyProxy` (avg v^2 at end)
- `budgetScale` histogram (0-0.25 / 0.25-0.5 / 0.5-0.75 / 0.75-1)

**Sample output table (format, not run in this report)**
| N | settleMs | overshootMax | jitterAvg | pbdCorrectionAvg | corrOpposePct | energyProxy | budgetBins |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | 3400 | 1.20 | 0.0012 | 0.420 | 12.5 | 0.002 | 0/0/0/480 |
| 20 | 3600 | 1.35 | 0.0014 | 0.480 | 14.1 | 0.003 | 0/0/0/480 |
| 60 | 3900 | 1.55 | 0.0017 | 0.520 | 16.3 | 0.004 | 5/10/25/440 |

## 9) Single-Law MotionPolicy
**Module**: `src/physics/engine/motionPolicy.ts`

**Ownership map (edit here for motion law)**
- Scale-safe thresholds: density radii, epsilon distances, speed/force epsilons.
- Interaction parameters: local boost strength/radius/frames, release damping.
- Rest ladder parameters: settle thresholds + micro-kill strength.

**Wiring**
- `engineTick` computes and stores `motionPolicy` each tick.
- `settleLadder` and `interactionAuthority` now read thresholds from MotionPolicy.
- Velocity passes (angular decoherence, edge shear, dense-core inertia, static friction, dense-core unlock, carrier flow) consume MotionPolicy for their scale-safe constants.

## Risks / Known Limitations
- The harness is dev-only and requires debugPerf enabled; it should not run in production.
- Remaining legacy constants outside of motion/interaction (rendering/UI) were not touched.
- The sample harness output table is a format example; run the harness to produce real values.

