# Physics Perf Fix Report (Step 2)

## Changes Applied
- Added pairwise sampling to cap O(n^2) work per frame for repulsion, collision, spacing, and safety clamp.
- Repulsion and collision sampling uses a stride with deterministic hashing; collision offset is phase-shifted to avoid identical pair coverage.
- Spacing sampling uses the same stride but scales the pair budget by the spacing energy gate to avoid a sudden cost spike at the 0.7 threshold.
- Safety clamp sampling uses the base stride with a different phase offset.
- Added config knobs to tune pairwise budget without redesigning the solver.

## Code References
- Pairwise sampling and offsets:
  - `src/physics/forces.ts:8-176` (repulsion + collision sampling)
  - `src/physics/engine/constraints.ts:87-382` (spacing + safety clamp sampling)
  - `src/physics/engine/forcePass.ts:162-178` (pass-specific offsets)
  - `src/physics/engine.ts:270-402` (stride computation and pass wiring)
- New config defaults:
  - `src/physics/types.ts:106-113`
  - `src/physics/config.ts:121-129`

## Timing (Before/After)
- Not captured in this environment (no live render loop).
- Use `debugPerf: true` and compare:
  - Before: set `pairwiseMaxStride: 1` (no sampling).
  - After: default `pairwiseMaxStride: 8`.
- Logs appear once per second:
  `[PhysicsPerf] avgMs repulsion=... collision=... springs=... spacing=... pbd=... total=... frames=...`

## Edgecases Impact
- Quadratic wall: sampling caps pair checks per frame; worst-case spikes drop as dot count grows.
- Dense ball: spacing/collision/repulsion now rotate through pair subsets; PBD corrections still diffuse without blocking the main thread.
- "Everything neighbor" moment: different pass offsets reduce simultaneous heavy pair work on identical subsets.

## Tradeoffs
- Slightly softer constraints under extreme density (some pair corrections deferred to later frames).
- Visual "buoyant" feel preserved: no changes to de-locking, drift, or correction diffusion.

## Follow-Up
- Capture real timing logs in the app for sparse vs dense layouts.
- If dense blobs still spike, reduce `pairwiseMaxChecks` or increase `pairwiseMaxStride` incrementally.
