# Physics Perf Edgecases 4-6 Scandissect

## Loop Diagram (Current)
- Entry: `requestAnimationFrame` loop in `src/playground/useGraphRendering.ts:92-224`.
- Per frame flow:
  - `now = performance.now()`
  - `dtMs = now - lastTime`
  - `dt = min(dtMs / 1000, 0.1)` (hard clamp)
  - `engine.tick(dt)` once per render frame
  - Render + camera + hover logic
- No accumulator or while-loop; the simulation steps once per frame. There is no fixed timestep logic.

## Edgecase 4: "Startup Turbo" Cliff (Spacing Gate)
- Energy computed in `computeEnergyEnvelope` in `src/physics/engine/energy.ts:8-36`.
- Spacing activation is gated by energy in `applySpacingConstraints`:
  - Only runs when `energy <= 0.7`.
  - Smoothstep gate ramps from `energy=0.7` to `energy=0.4` (`src/physics/engine/constraints.ts:104-114`).
- Why hitch happens:
  - Spacing pass is O(n^2) and begins running right after the energy threshold is crossed.
  - Even with the internal correction ramp, the *cost* of the pass appears suddenly because it starts iterating all pairs once enabled.

## Edgecase 5: dt Clamp "Time Dilation"
- dt clamp is in the render loop: `dt = min(dtMs / 1000, 0.1)` (`src/playground/useGraphRendering.ts:116-119`).
- Effect:
  - After a long frame, the sim advances only 0.1s even if real time passed is much larger.
  - The simulation effectively drops time, so the graph appears to move in slow motion for that frame (and never fully catches up).

## Edgecase 6: Multi-Step Loop Risk
- Current loop has no accumulator and no while-stepping, so it cannot execute multiple ticks per frame today.
- Risk:
  - If a future refactor adds an accumulator with a while-loop, it could run multiple ticks and spike CPU.

## Instrumentation (Added)
- Aggregate per-second render-loop stats:
  - `avgTickMs`, `maxTickMs`, `ticksPerFrame` (should be 1 today).
  - Logged when `engine.config.debugPerf` is true.
  - Source: `src/playground/useGraphRendering.ts:100-150`.
- Engine per-pass timing already available:
  - `repulsionMs`, `collisionMs`, `spacingMs`, `pbdMs`, `totalMs` via `debugPerf` logging.
  - Source: `src/physics/engine.ts:239-385`, `src/physics/engine/forcePass.ts:162-178`.

## Baseline Metrics (Not Captured)
- Baseline timing and ticks-per-frame were not measured in this environment.
- Use `debugPerf: true` to capture:
  - `[RenderPerf] avgTickMs=... maxTickMs=... ticksPerFrame=...`
  - `[PhysicsPerf] avgMs repulsion=... collision=... spacing=... pbd=... total=...`
