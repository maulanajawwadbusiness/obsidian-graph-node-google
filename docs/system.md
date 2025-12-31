# System Architecture – Obsidian-Style Graph Physics Engine

## Repository Structure (Up-to-Date)

```
.
├── docs/
│   ├── system.md
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
  - `docs/system.md`: System overview, repo structure, and physics engine responsibilities.
  - `docs/vision.md`: High-level product/experience vision notes.
- `public/`
  - `public/Quicksand-Light.ttf`: Static font asset served by Vite.
- `src/`
  - `src/assets/Quicksand-Light.ttf`: App-bundled font asset referenced by CSS.
  - `src/docs/organic-shape-creation.md`: Research notes on organic shape modeling.
  - `src/physics/`
    - `src/physics/config.ts`: Default physics configuration values and tuning constants.
    - `src/physics/engine.ts`: Core physics engine implementation and simulation loop.
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

`src/physics/engine.ts` currently handles the entire physics lifecycle, including:

- **Main loop / scheduling**
  - Owns `tick(dt)` with the full frame lifecycle, phase gating, and energy envelope.
  - Handles lifecycle timers (`lifecycle`, `preRollFrames`, `hasFiredImpulse`).

- **Force computation**
  - Clears forces, calls force helpers (`applyRepulsion`, `applySprings`, `applyCollision`, `applyBoundaryForce`), and scales them by energy.
  - Applies drag forces and custom velocity biases (carrier flow, drift).

- **Constraints**
  - Spacing constraints (soft/hard zones, escape windows, hub exceptions).
  - Triangle area preservation constraints.
  - Angle resistance constraints and tangential correction logic.
  - Final correction accumulation, budgeting, and diffusion.

- **Phase logic**
  - Pre-roll phase (soft separation, micro-carrier drift, symmetry breaking).
  - Impulse phase (one-shot topology kick).
  - Expansion vs. settling gates based on the energy envelope.

- **Utilities / state management**
  - Node/link management, wake/sleep, bounds updates, and drag lifecycle.
  - Global spin/angle tracking for render-time rotation.
  - Per-node degree calculation and neighbor maps.

- **Special-case hacks**
  - Symmetry-breaking biases for trapped hubs (carrier flow and directional persistence).
  - Escape windows to temporarily skip constraints.
  - Deadlock prevention and biasing via clamps, hysteresis, and correction diffusion.

## Why `engine.ts` Reached ~1500 Lines

The engine grew because the full simulation loop, phase transitions, force application, and a large set of iterative constraint/symmetry-breaking behaviors are all co-located for tuning. Most of the experimental “feel” adjustments (pre-roll logic, energy gating, escape windows, hub exceptions, and diffusion) live inside the tick loop so they can coordinate directly, which has accumulated into a single large module rather than being split into smaller subsystems.
