# Physics Energy Leak Edgecases Fixes

Date: 2026-02-01

## Scandissect Notes
- Tick orchestration: `src/physics/engine.ts` (`PhysicsEngine.tick`) runs force pass, integration, velocity passes, then PBD constraints with diffusion.
- Spacing gate: `src/physics/engine.ts` used an energy threshold at 0.7 to turn on spacing, with an exponential rise; spacing frequency and stride computed in the PBD block.
- Repulsion/collision: `src/physics/forces.ts` (pairwise forces), scheduled by `src/physics/engine/forcePass.ts`.
- Spacing constraints: `src/physics/engine/constraints.ts` (`applySpacingConstraints`) uses soft and hard zones with `spacingGate` scalar.
- PBD diffusion and per-node budget: `src/physics/engine/corrections.ts` (uses `maxNodeCorrectionPerFrame`, 60% diffusion).
- Energy envelope: `src/physics/engine/energy.ts` (exponential decay; energy drives force scale and damping).
- Logs: `[PhysicsPerf]` in `src/physics/engine.ts`, `[Physics]` in `src/physics/engine/debug.ts`.

## Changes By Edgecase

### 1) Spacing Gate Threshold Discontinuity
Before:
- `spacingGate` targeted 0 unless energy <= 0.7, then a smoothstep ramp to 1.0.
- `spacingStride` jumped to a minimum 10% budget once gate was nonzero.
- Spacing execution was gated by `spacingGate > 0.02` with no hysteresis.

After:
- Added stateful gate with hysteresis and a smooth ramp (`spacingGateOnEnergy`, `spacingGateOffEnergy`, `spacingGateRampStart`, `spacingGateRampEnd`).
- Removed the hard 10% budget floor, so stride scales continuously with `spacingGate`.
- Added throttled per-second log: `[PhysicsSpacing] energy, spacingStrength, spacingEnabled, spacingFreq, mode`.

Files:
- `src/physics/engine.ts`
- `src/physics/types.ts`
- `src/physics/config.ts`

### 2) Dense-Ball Energy Pile-Up
Before:
- Repulsion and collision could spike at near-zero distances (1/d and overlap * strength).
- Diffusion always spread 60% of corrections regardless of density or spacing pressure.

After:
- Added per-pair caps and min-distance clamp for repulsion (`repulsionMinDistance`, `repulsionMaxForce`).
- Added per-pair collision force cap (`collisionMaxForce`).
- Reduced correction diffusion under high density and high spacing pressure (density and spacing attenuations in `applyCorrectionsWithDiffusion`).

Files:
- `src/physics/forces.ts`
- `src/physics/engine/corrections.ts`
- `src/physics/types.ts`
- `src/physics/config.ts`

### 3) Hot-Pass Cascade (Repulsion + Collision + Spacing)
Before:
- Repulsion, collision, and spacing could all run in the same frame under dense conditions.

After:
- Added deterministic cascade staggering: when `spacingGate` is high and pair sampling is active, pairwise forces skip the spacing phase.
- Spacing runs on a fixed phase modulo; repulsion and collision avoid that phase to prevent triple-hot frames.
- Added throttled per-second log: `[PhysicsPasses] repulsion, collision, spacing, pairStride, spacingStride, offsets, cascade, phase`.

Files:
- `src/physics/engine.ts`
- `src/physics/engine/forcePass.ts`
- `src/physics/types.ts`
- `src/physics/config.ts`

## New Config Knobs (Defaults)
- `repulsionMinDistance`: 6
- `repulsionMaxForce`: 1200
- `collisionMaxForce`: 1800
- `correctionDiffusionBase`: 0.6
- `correctionDiffusionMin`: 0.2
- `correctionDiffusionDensityScale`: 0.15
- `correctionDiffusionSpacingScale`: 0.5
- `spacingGateOnEnergy`: 0.72
- `spacingGateOffEnergy`: 0.78
- `spacingGateRampStart`: 0.75
- `spacingGateRampEnd`: 0.45
- `spacingGateRiseTime`: 0.6
- `spacingGateEnableThreshold`: 0.02
- `spacingCascadeGate`: 0.25
- `spacingCascadePhaseModulo`: 3
- `spacingCascadeSpacingPhase`: 2

## Repro and Validation Notes (Manual)
- Dense blob start: initialize many dots in a tight cluster and let the system settle.
- Watch logs with `debugPerf: true` for `[PhysicsSpacing]` and `[PhysicsPasses]`.
- Confirm spacing strength ramps smoothly with no visible snap as energy decays.
- Confirm no boiling or large spikes when dots are nearly coincident.
- Confirm spacing ticks do not coincide with repulsion/collision on cascade frames.

Manual verification is still required in the UI; no browser automation was used.
