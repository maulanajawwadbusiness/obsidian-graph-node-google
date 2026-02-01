# Patch Notes: Mode Isolation & Leak Tripwires

## Core Architecture
*   **Mode Router**: `engineTick.ts` now routes execution to either `runPhysicsTickLegacy` (existing) or `runPhysicsTickXPBD` (new) based on `useXPBD` config flag.
*   **Clean XPBD Pipeline**: Created `engineTickXPBD.ts` containing a "clean room" physics tick that strictly excludes legacy PBD heuristics.
*   **Refactored Integration**: `integrateNodes` now accepts a `useXPBD` flag to disable legacy "Carrier Flow" and "Hub Velocity Scaling" heuristics when in XPBD mode.

## Forensics & Telemetry
*   **Tripwire System**: Added `assertMode` helper to `engineTick.ts`. Any legacy pass (e.g., `applySpacingConstraints`) called while in XPBD mode will trigger a "Leak" alert.
*   **Debug Stats**: Added `forbiddenPassCount`, `forbiddenLeakLatched`, and `mode` fields to `DebugStats`.
*   **HUD Update**: Physics HUD now displays the current Mode (`LEGACY` vs `XPBD`) and will flash leak warnings if strict isolation is violated.

## Code Safety
*   Instrumented all critical legacy functions in `engineTick.ts` with `assertMode` checks.
*   Verified that `integrateNodes` side-effects are properly gated.

## Usage
To enable XPBD mode (Skeleton only, no checks yet):
```typescript
engine.config.useXPBD = true;
```
To verify isolation:
Check HUD for "Mode: XPBD" and ensure "Forbidden Pass" count remains 0.
