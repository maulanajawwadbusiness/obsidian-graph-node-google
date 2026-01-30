# Side Report: Engine + Rendering Modularization

## Why
- `src/physics/engine.ts` and `src/playground/useGraphRendering.ts` had grown into single-file control centers, making targeted debugging harder and obscuring responsibility boundaries.
- The refactor keeps behavior intact while separating physics tick scheduling and render loop orchestration into focused modules.

## What Changed
- Extracted the physics tick flow into `src/physics/engine/engineTick.ts`, including perf-mode transitions and per-frame gating logic.
- Centralized time utilities in `src/physics/engine/engineTime.ts` for shared use across engine lifecycle methods.
- Moved the render-loop and scheduling logic out of `useGraphRendering` into `src/playground/rendering/graphRenderingLoop.ts`, keeping hook wiring lightweight.

## Verification
- Manual sanity: ensured render loop still updates hover energy, drag authority, camera stabilization, and perf logging paths.
- No behavior changes intended; all controls and debug logging are preserved.
