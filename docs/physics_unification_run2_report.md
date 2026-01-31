# Physics Unification Run 2 Report

Date: 2026-01-31

## Scope (Run 2: Steps 4–6)
This run consolidates settling into a single ladder, centralizes interaction authority, and hardens degrade invariants so cadence changes never alter the physics law.

## 4) Unified Rest Ladder (Moving → Cooling → Microkill → Sleep)
**What changed**
- Added a canonical settle pipeline that evaluates normalized speed, constraint residual, and jitter to produce a single settle state.
- Sleep gating moved into the settle ladder with normalized thresholds (per-node speed/correction/jitter).
- The solver “coma” now triggers only in fatal emergency mode, not as a normal rest mechanism.

**Where**
- `src/physics/engine/settleLadder.ts` (`applySettleLadder`)
- `src/physics/engine/engineTick.ts` (settle ladder integration + debug logs)

**Behavioral intent**
- Rest is achieved by continuous cooling and microkill damping that converges velocity + correction residuals toward zero.
- Post-rest injectors are suppressed when the ladder enters microkill/sleep.

## 5) Unified Interaction Authority (Drag is the Law)
**What changed**
- Centralized interaction authority policy with continuous local boost strength/radius and release handoff logic.
- Release now uses a damped handoff impulse instead of hard-zeroing velocity unless the hand is still.
- Drag velocity tracking is smoothed to prevent release spikes.

**Where**
- `src/physics/engine/interactionAuthority.ts` (`computeInteractionAuthorityPolicy`)
- `src/physics/engine.ts` (drag velocity tracking + release handoff)
- `src/physics/engine/engineTick.ts` (local boost policy integration)

**Behavioral intent**
- Drag remains knife-sharp, while release transitions smoothly back into the world law.
- Local boost is continuous and derived from unified density/authority scalars rather than fixed ladders.

## 6) Degrade Invariants (Cadence Only)
**What changed**
- Explicitly documented that degrade affects cadence only.
- Added debug summary logging that reports budgetScale, degradeLevel, skipped passes, and PBD corrections per frame.

**Where**
- `src/physics/engine/engineTick.ts`

**Behavioral intent**
- Degrade never changes stiffness or force equations, only how often passes run.

## Debug / Instrumentation
- `Settle` log: state, timeToSleepMs, jitterAvg.
- `DegradeSummary` log: budgetScale, degrade level, skipped passes, PBD correction magnitude.
- `Hand` release log: whether a release impulse was applied and why.

## Risks & Follow-ups (Run 3)
- Fine-tune settle thresholds if microkill over-damps in very low-density scenes.
- Expand interaction authority to apply continuous local-boost radius to far-field pass selection.
- Convert remaining energy/density gates to unified ramps (edge shear, angular decoherence, etc.).

