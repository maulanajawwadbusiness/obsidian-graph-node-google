# XPBD Run 1–2: Link Springs + Min-Distance Repulsion

## Unit Bible (Native Scale)

| Quantity | Native Units | Source | Notes |
| --- | --- | --- | --- |
| Dot radius (spine/rib/fiber) | 8 / 6 / 4 px | `src/playground/graphRandom.ts` | Base spawn radii before theme scaling. |
| Link rest length | 130 px | `src/physics/config.ts` | `linkRestLength` default. |
| Target spacing | 375 px | `src/physics/config.ts` | Default spacing for initial layout. |
| Tick dt | seconds | `src/physics/engine/dtPolicy.ts`, `src/physics/engine/engineTick.ts` | `TimePolicy` yields `dtUseSec` (clamped ms → sec). |
| Damping | 0.90 | `src/physics/config.ts` | Applied per tick via velocity pass. |
| Coordinate units | World px | `src/playground/rendering/graphDraw.ts` | Renderer draws directly from `PhysicsNode.x/y` (world → screen). |

## Injection Point (Why This Stage)

XPBD constraints are injected **after** `applyCorrectionsWithDiffusion` and **before** `finalizePhysicsTick` in `runPhysicsTick`. This ensures corrected `PhysicsNode.x/y` values are the final positions used by the renderer, and nothing later overwrites them. (`src/physics/engine/engineTick.ts`).

## New Dev Toggles (Run 1–2)

All toggles live in the Physics HUD “Advanced” panel:

- **XPBD Core** (`xpbdEnabled`): Switches on XPBD constraints and disables legacy spring/repulsion forces.
- **Canary Shift** (`debugXpbdCanary`): Adds a visible +30px, -20px offset to final positions to prove stage correctness.
- **Force Stiff** (`debugForceStiffSprings`): Forces very low compliance and higher iterations for springs.
- **Force Repel** (`debugForceRepulsion`): Forces very low compliance and higher iterations for repulsion.

## XPBD Implementation Notes

- **Springs (Run 1)**: XPBD distance constraints solve `C = dist - restLen` per link using compliance and iterations. Legacy spring forces are disabled when XPBD is active.
- **Repulsion (Run 2)**: XPBD min-distance constraints enforce `C = minDist - dist` using a spatial hash (3×3 neighbor query). `minDist` is tied to `radius + radius + collisionPadding` (native px) to prevent overlap.
- **HUD Stats**: Spring and repulsion correction averages, max values, and pair counts are surfaced per frame.

## Manual Verification Checklist

1. **Canary**: Enable **Canary Shift**. The graph should jump +30px X and -20px Y immediately. Disable after verifying stage correctness.
2. **Stiff Springs**: Enable **Force Stiff** and observe links snap toward `linkRestLength` (130px). The HUD should show non-zero spring correction avg/max.
3. **Repulsion**: Enable **Force Repel** and observe overlapping dots separate quickly. HUD should show non-zero repulsion pairs and overlap count decreasing.
4. **Final Check**: Disable canary and confirm layout still responds to XPBD constraints with visible corrections.

