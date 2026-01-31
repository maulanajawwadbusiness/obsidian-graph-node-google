# Unified Movement Spec (Arnvoid Physics)

Title: Arnvoid physics unification - unified movement law
Date: 2026-01-31

## Intent
Unify Dot motion into a single continuous law that feels identical across counts (N=5 .. 500+). Degrade reduces workload only, never changes equations or stiffness.

## Core Scalars (Continuous, Scale-Free)
- temperature (0..1): replaces all hard energy gates. 1.0 at birth, asymptotically to 0.
- density (0..1): normalized local neighbor count based on interactionLength, not fixed px.
- degree (0..1): normalized link degree (e.g., degNorm = clamp((deg-1)/4, 0..1)).
- authority (0..1): per-Dot priority (dragged=1.0, neighbors falloff).
- budgetScale (0..1): workload scalar used only for sampling/stride, not stiffness.

## Unified Law (applies every frame)

Let:
- x: position, v: velocity, m: mass
- F: soft forces (repulsion, springs, center, boundary)
- C: constraint correction as a force-equivalent (bounded by budget)
- damp(temperature): continuous damping curve

Single update:
1) v = (v + (F + C) / m * dt) * damp(temperature)
2) x = x + v * dt

Constraints are applied as a bounded C term, not a second, conflicting positional snap.

## Move (Free Motion)
- Forces are always on; no hard gates.
- Repulsion and spacing use a shared interactionLength derived from targetSpacing and Dot radius.
- Density only scales magnitudes smoothly; no neighbor-count thresholds.
- Springs use a continuous dead-zone width based on temperature and degree (no hub bypass).

Expected feel:
- Dots drift and shear smoothly regardless of N.
- Large and small graphs have the same apparent stiffness and damping.

## Response (Interaction / Drag / Local Bubble)
- Dragged Dot has authority=1.0: direct kinematic position override, zero lag.
- Neighbor authority is a smooth radial falloff (e.g., exp(-r / interactionLength)).
- All passes consult authority once (forces, constraints, diffusion). No scattered if-blocks.
- Constraint budget ramps up with authority (pay-now near hand, deferred far away).

Expected feel:
- Dragged Dot is knife-sharp at all counts.
- Surrounding Dots yield smoothly with no sideways squirt or snap back.

## Settle (Sleep / Rest / Hysteresis)
- Sleep threshold uses normalized speed: v < sleepEps for N frames.
- sleepEps is tied to interactionLength and dt (scale-free).
- Micro jitter is only allowed when temperature > 0.0 and authority == 0.
- Once asleep: v=0 and correction residuals cleared (no ghost drift).

Expected feel:
- Fast settle without crawl.
- Dead rest is truly still (no visible creep).

## Degrade Invariants (Must Hold Across Scale)
- Degrade only reduces sampling frequency or pair coverage; it never changes force equations.
- Stiffness, damping, and rest lengths remain invariant.
- Hot pairs (near constraint violations) retain full coverage regardless of budget.

## Unified Knobs (Replace Patch Stack)
- interactionLength: one scale for density, spacing, and micro-slip.
- temperature: replaces all energy > 0.85 gates.
- authority: replaces scattered drag exceptions.
- budgetScale: only affects sampling/stride.
- hubBias: a continuous degree-based modifier (no binary hub switches).

## Invariants Across Node Counts
- Rest length and spacing ratios are identical at N=5 and N=500.
- Drag feel is identical at all N (lagP95 ~ 0.0).
- Time-to-settle does not increase superlinearly with N.
- Micro jitter remains below epsilon when settled.

## Validation Targets (use `[PhysicsScale]`)
- settleMs stable across N=5/20/60/250/500 (+/- 20%).
- jitterAvg and residualSum stay low and do not climb with N.
- overshootMax is bounded and similar across N.
- degrade% shows workload shifts, but force feel remains unchanged.

-- End of unified movement spec --
