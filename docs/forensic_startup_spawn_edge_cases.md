# Forensic: Startup & Spawn Edge Cases

## Pipeline Map
1.  **Generation** (`graphRandom.ts`):
    - `generateRandomGraph()` creates nodes/links.
    - `initStrategy='spread'`: Uses Golden Angle Spiral.
        - Checks collision against *previous* nodes only.
        - `minSpawnSpacing` = 2px (Risk: tight overlap).
        - Logic is O(N^2) simple scan. Safe for N=500, but relies on luck for true clearance.
    - `initStrategy='legacy'`: Random box distribution + Impulse.

2.  **Engine Init** (`engine.ts`):
    - `addNode()`: Wakes node, invalidates warm start.
    - `resetLifecycle()`: Sets `lifecycle=0`, `preRollFrames=5` (if legacy).

3.  **First Tick / Startup** (`engineTick.ts`):
    - `allowLegacyStart`: Gates `preRoll` and `impulse`.
    - `preRollActive`: If legacy, runs `runPreRollPhase`.
    - `Impulse`: If legacy, fires `requestImpulse()` at `lifecycle < 0.1`.
    - `MotionPolicy`:
        - `earlyExpansion`: Derived from `temperature` (0.72-0.9).
        - Used by `expansionResistance`, `angleResistance`, `hubConstraint`.
    - **Risk**: `earlyExpansion` curve might be too aggressive at t=0 if temperature starts at 1.0 instantly.

## Inventory of Start-Only Logic

| Name | Location | Trigger | Effect | Risk | Plan |
|---|---|---|---|---|---|
| **Init Impulse** | `engineTick.ts:340` | `lifecycle < 0.1` (Legacy) | Large radial velocity injection | Explosive start, undefined max velocity. | **Quarantine**: Disable unless `legacy`. |
| **Pre-Roll** | `engineTick.ts:335` | `preRollFrames > 0` (Legacy) | Soft constraint solving only | Delays physics, visual freeze. | **Quarantine**: Disable unless `legacy`. |
| **Spread Seeding** | `graphRandom.ts:26` | `initStrategy='spread'` | Placement | No guarantee of non-overlap. O(N^2). | **Harden**: Add spatial hash validation + ensure distinct coords. |
| **Early Expansion**| `motionPolicy.ts` | `temperature` based | Boosts various forces | "Special" physics laws at start. | **Keep**: But ensure it's smooth, not a hard toggle. |
| **Idle Frames** | `engineTick.ts:317` | `settleScalar > 0.99` | Hard velocity zeroing | "Sticky" start if initialized near rest. | **Refine**: Ensure valid start temperature prevents immediate sleep. |
| **First Frame DT** | `engineTick.ts` | `dt` | Integration stability | Huge DT can eject nodes. | **Clamp**: Enforce max DT (120ms) or subdivide. |

## Proposed Fixes
1.  **Harden Seeding**: Rewrite `generateSpreadPositions` to use a spatial grid for O(N) validation and enforce strictly `> epsilon` separation.
2.  **Quarantine Legacy**: Ensure `preRoll` and `impulse` blocks are unreachable with default config.
3.  **Safety Firewall**:
    - Add a "Sanity Check" pass at the start of `engineTick` (or end).
    - If `x/y` is NaN/Inf, reset to safe bounds.
    - Clamp `vx/vy` to `maxVelocity` * 1.5 (generous safety net).
4.  **DT Safety**: Ensure first frame `dt` is clamped to e.g. 33ms to prevent initial explosion if main thread hung during setup.
