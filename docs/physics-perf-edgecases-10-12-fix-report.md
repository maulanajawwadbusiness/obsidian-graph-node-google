# Physics Perf Edgecases 10-12 Fix Report

## Changes Applied
- Decoupled physics ticks from rAF frequency by using `targetTickHz` (default 60) in the render loop; high refresh rates no longer increase tick count.
- Added adaptive performance modes (`normal/stressed/emergency/fatal`) based on N/E thresholds with hysteresis.
- Reduced expensive passes under stress: spacing runs less frequently and springs are staggered in emergency mode.
- Added fatal-mode guardrails: when N/E exceed safe thresholds, heavy passes are skipped and the sim stays responsive.
- Expanded perf logging to report ticks per second and mode state.

## Code References
- Tick rate control and per-second tick metrics: `src/playground/useGraphRendering.ts:120-210`.
- Adaptive mode selection + throttling: `src/physics/engine.ts:286-520`.
- Emergency pass gating: `src/physics/engine.ts:408-476`, `src/physics/engine/forcePass.ts:166-188`.
- Mode thresholds config: `src/physics/config.ts:59-83`, `src/physics/types.ts:96-132`.

## Before/After Ticks-Per-Second
- Before: tick rate depended on rAF cadence (120/144Hz could increase compute).
- After: tick rate is capped at `targetTickHz` (default 60); render continues at monitor refresh.

## Adaptive Degradation Rules
- **Stressed**: spacing runs every 2 ticks; pairwise budget scaled to 70%.
- **Emergency**: spacing runs every 4 ticks; springs run every other tick; pairwise budget scaled to 40%.
- **Fatal**: heavy passes skipped; only drag + integration runs to keep responsiveness.
- Hysteresis: downshift uses `perfModeDownshiftRatio` (default 0.9) to avoid mode thrash.

## Fatal-Mode Guardrails
- Mode enters fatal when `N >= perfModeNFatal` or `E >= perfModeEFatal`.
- Logs `[PhysicsFatal]` once per second while in fatal mode.
- Simulation remains responsive (no full n^2 passes).

## Tradeoffs
- Under emergency/fatal modes, physical accuracy is reduced (spacing/springs less frequent).
- In fatal mode, the graph becomes more static; this is intentional to keep the app responsive.
