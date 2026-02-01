# Run 1: Spring–Mass Backend ("One Law")

## Summary
A new spring–mass physics backend was added under a feature flag to drive dot motion with a single force pipeline: **sum forces → integrate → damping → settle**. The legacy physics engine remains intact and selectable via config/UI toggle.

## Files Touched
- `src/physics/springMass/springMassBackend.ts`
- `src/physics/engine.ts`
- `src/physics/types.ts`
- `src/physics/config.ts`
- `src/playground/components/CanvasOverlays.tsx`
- `docs/run1_spring_mass_backend.md`

## Equations (Exact)
For each link between dots `a` and `b`:
- Displacement: `d = p_b - p_a`
- Length: `len = |d|`
- Direction (safe): `dir = d / len` (skipped if `len` is ~0)
- Rest length: `rest = link.length ?? initialDistance` (cached on first encounter)
- Hooke’s law: `F = k * (len - rest) * dir`
- Apply equal/opposite forces to both dots (skipped if dot is fixed)

Per dot (mass `m`), after summing forces:
- Acceleration: `a = F / m`
- Semi-implicit Euler:
  - `v = v + a * dtFixed`
  - `x = x + v * dtFixed`
- Damping: `v = v * damping`
- Basic settle: if `|v|^2 < settleSpeedSq`, snap `v = 0`

## Constants (Run 1)
- `dtFixed = 1/60`
- `k_spring = config.springStiffness` (default `0.2`)
- `damping = config.damping` (default `0.90`)
- `centerPull = config.gravityCenterStrength` (default `0.01`)
- `maxSpringForce = 2400`
- `maxVelocity = config.maxVelocity` (default `80`)
- `settleSpeedSq = 0.0004` (≈ `0.02 px/frame`)

## Toggle
- **Config Flag:** `useSpringMassPhysics`
- **UI:** Debug panel → “Spring-Mass (Run 1)” → “Use spring-mass backend”

## Known Limitations (Run 1)
- Drag handling is not yet revalidated for spring–mass (drag can be broken for now).
- Repulsion is minimal/off (no extra overlap prevention yet).
- No PBD, diffusion, micro-slip, or constraint correction in this backend.

## Manual Acceptance Steps (Run 1)
1. Enable spring-mass backend via the debug checkbox.
2. Spawn graphs with N=5, N=20, N=60.
3. Verify: layout moves, settles, no NaNs/explosions, motion decays over time.
