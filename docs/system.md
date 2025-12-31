# System Architecture – Obsidian-Style Graph Physics Engine

## Repository Structure (Up-to-Date)

```
.
├── docs/
│   ├── physics-engine-audit.md
│   ├── system.md
│   ├── tuning-guide.md
│   └── vision.md
├── public/
│   └── Quicksand-Light.ttf
├── src/
│   ├── assets/
│   │   └── Quicksand-Light.ttf
│   ├── docs/
│   │   └── organic-shape-creation.md
│   ├── physics/
│   │   ├── config.ts
│   │   ├── engine/
│   │   │   ├── constraints.ts
│   │   │   ├── corrections.ts
│   │   │   ├── debug.ts
│   │   │   ├── degrees.ts
│   │   │   ├── energy.ts
│   │   │   ├── escapeWindow.ts
│   │   │   ├── forcePass.ts
│   │   │   ├── impulse.ts
│   │   │   ├── integration.ts
│   │   │   ├── preRollPhase.ts
│   │   │   ├── stats.ts
│   │   │   └── velocityPass.ts
│   │   ├── engine.ts
│   │   ├── forces.ts
│   │   ├── test-physics.ts
│   │   └── types.ts
│   ├── playground/
│   │   └── GraphPhysicsPlayground.tsx
│   ├── utils/
│   │   └── seededRandom.ts
│   ├── index.css
│   └── main.tsx
├── index.html
├── package-lock.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### File/Folder Purposes

- `docs/`
  - `docs/physics-engine-audit.md`: Deep audit + sharp-engine proposal (source of truth for refactor intent).
  - `docs/system.md`: System overview, repo structure, and physics engine responsibilities.
  - `docs/tuning-guide.md`: Short guide for human tuning and “feels good” checks.
  - `docs/vision.md`: High-level product/experience vision notes.
- `public/`
  - `public/Quicksand-Light.ttf`: Static font asset served by Vite.
- `src/`
  - `src/assets/Quicksand-Light.ttf`: App-bundled font asset referenced by CSS.
  - `src/docs/organic-shape-creation.md`: Research notes on organic shape modeling.
  - `src/physics/`
    - `src/physics/config.ts`: Default physics configuration values and tuning constants.
    - `src/physics/engine.ts`: Orchestrates the tick order and lifecycle.
    - `src/physics/engine/forcePass.ts`: Force-only accumulation (springs, repulsion, collision, boundary, pre-roll forces).
    - `src/physics/engine/velocityPass.ts`: Velocity-only shaping (pre-roll drift, carrier flow, angle resistance, expansion resistance).
    - `src/physics/engine/constraints.ts`: Position correction requests (spacing, triangle area, edge relaxation, safety clamp).
    - `src/physics/engine/corrections.ts`: Final position writer applying correction budgets and diffusion.
    - `src/physics/engine/integration.ts`: Integrates forces/velocity into positions and applies damping.
    - `src/physics/engine/stats.ts`: Per-frame debug stats aggregation (no UI yet).
    - `src/physics/forces.ts`: Force-application helpers (repulsion, springs, boundaries, collisions).
    - `src/physics/test-physics.ts`: Local physics sanity checks / debug harness.
    - `src/physics/types.ts`: Type definitions for physics nodes, links, and config.
  - `src/playground/GraphPhysicsPlayground.tsx`: React UI + canvas playground for running the simulation.
  - `src/utils/seededRandom.ts`: Deterministic RNG helper for reproducible layouts.
  - `src/index.css`: Global styles and font-face definitions.
  - `src/main.tsx`: React entry point bootstrapping the playground.
- `index.html`: Vite HTML entry template.
- `package-lock.json`: NPM dependency lockfile.
- `package.json`: NPM scripts, dependencies, and metadata.
- `tsconfig.json`: TypeScript compiler configuration.
- `vite.config.ts`: Vite build/dev server configuration.

> Notes:
> - `node_modules/` and `.git/` exist locally but are not part of the authored code. They contain third-party dependencies and git metadata, respectively.

## `engine.ts` Responsibilities

`src/physics/engine.ts` owns the simulation loop and delegates to the subsystem passes:

- **Main loop / scheduling**
  - Owns `tick(dt)` with the full frame lifecycle, phase gating, and energy envelope.
  - Handles lifecycle timers (`lifecycle`, `preRollFrames`, `hasFiredImpulse`).

- **Force computation**
  - Calls the force-only pass (`applyForcePass`) which applies springs, repulsion, collision, boundary, and pre-roll forces.

- **Velocity shaping**
  - Calls the velocity-only pass (`velocityPass.ts`) for carrier drift, symmetry breaking, expansion resistance, and angle resistance.

- **Integration**
  - Integrates forces into velocity and positions (`integrateNodes`), with damping and velocity caps.

- **Constraints & corrections**
  - Spacing constraints (soft/hard zones, escape windows, hub exceptions).
  - Triangle area preservation constraints.
  - Edge relaxation (post-solve shape uniformity).
  - Safety clamp (rare, deep penetration only).
  - Final correction diffusion and budget application.

- **Instrumentation**
  - Generates per-frame `DebugStats` snapshots (force/velocity/correction totals + safety metrics).

- **Utilities / state management**
  - Node/link management, wake/sleep, bounds updates, and drag lifecycle.
  - Global spin/angle tracking for render-time rotation.
  - Per-node degree calculation and neighbor maps.
  - Escape windows and carrier direction persistence.

## Why `engine.ts` Remains Slim

The engine remains a coordinator: it owns ordering and phase gates, but delegates computation to subsystem passes (`forcePass.ts`, `velocityPass.ts`, `constraints.ts`, `corrections.ts`). This keeps the physics pipeline readable and helps ensure clear ownership of each behavior.
