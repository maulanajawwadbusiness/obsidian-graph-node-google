# Physics XPBD Run 1-2 Report

## Scope
Run 1 + Run 2 only:
- XPBD link springs (distance constraints) wired into the main tick.
- XPBD min-distance repulsion using spatial hashing to prevent overlap.
- Canary + HUD stats for verification.

## Unit Bible (Native Scale)

| Item | Value | Source |
| --- | --- | --- |
| Dot radii (spine/rib/fiber) | 8 / 6 / 4 px (pre-theme) | `src/playground/graphRandom.ts` |
| Theme radius multiplier | Normal = 1.0, Elegant = 1.2 | `src/visual/theme.ts` |
| Link rest length | `linkRestLength = 130px` | `src/physics/config.ts` |
| Target spacing | `targetSpacing = 375px` | `src/physics/config.ts` |
| Tick target | `targetTickHz = 60` → 16.67ms | `src/physics/config.ts` |
| DT policy clamp | 2ms–50ms, spike @ 150ms | `src/physics/engine/dtPolicy.ts` |
| Coordinate units | World space ~ CSS px at zoom=1 | `docs/onboarding_dpr_rendering.md` |

## Injection Point (Render Reach)
- XPBD constraints are applied **after** `applyCorrectionsWithDiffusion` and **before** `finalizePhysicsTick`.
- This is the last mutator before render reads `PhysicsNode.x/y`, guaranteeing “reaches render.”
- Files:
  - `src/physics/engine/engineTick.ts` (injection site)
  - `src/physics/engine/xpbd.ts` (new XPBD passes)

## Toggles Added
Dev-only toggles (Canvas HUD → Advanced → XPBD):
- **XPBD Springs**: enable link distance constraints.
- **Force Stiff**: low compliance + extra iterations (visible snap).
- **XPBD Repel**: enable min-distance repulsion constraints.
- **Force Repel**: extra stiff/iterated repulsion for visibility.
- **Canary Shift**: one-shot +30/-20 shift after diffusion to validate “render reach.”

## HUD Stats Added
Physics HUD → “XPBD Run 1-2”:
- SpringCorr avg/max + constraint count
- RepelCorr avg/max + pair count + overlap count (dist < 0.5 * minDist)

## Manual Verification Checklist
1. Open the Debug panel → Advanced → **XPBD** toggles.
2. Enable **Canary Shift**:
   - Expect a visible shift (+30x, -20y) on the next tick. If no shift, you’re not in the render path.
3. Enable **XPBD Springs** + **Force Stiff**:
   - Links should snap toward `linkRestLength` immediately.
   - HUD: SpringCorr avg/max should rise above 0 with non-zero Spring Links.
4. Enable **XPBD Repel** + **Force Repel**:
   - Overlapping dots separate quickly.
   - HUD: RepelPairs > 0, RepelCorr avg/max > 0, Overlap count drops as layout settles.

## Notes
- Legacy force-based repulsion/springs are gated off when XPBD equivalents are enabled to prevent double-driving.
- XPBD uses world-space units and TimePolicy dt (`dtUseSec`) for compliance stability.
