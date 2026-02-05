# Repository X-Ray: Arnvoid

Generated for External AI Context Loading
Target: Deep Codebase Understanding without Repo Access
Date: 2026-02-04

## 1. Repository Tree (Depth 4)
Excluding: node_modules, dist, build, .git

```
.
|-- docs/                      # Extensive system documentation
|   |-- system.md              # MAIN SYSTEM DOC
|   |-- physics_xray.md        # PHYSICS DOCTRINE
|   |-- PHYSICS_ATLAS.md       # PHYSICS TRUTH HARNESS
|   |-- forensic_report_2026_02_01_doc_sync.md # DOCUMENTATION SYNC REPORT
|   |-- report_2026_01_31_modularization.md    # MODULARIZATION REPORT
|   |-- report_2026_02_01_comprehensive_physics_hardening.md # HARDENING REPORT
|   |-- report_2026_02_05_auth_session_postgres.md # Auth sessions, cookies, CORS
|   `-- ... (forensic reports)
|-- src/
|   |-- ai/                    # AI Layer (Provider Agnostic)
|   |   |-- clientTypes.ts     # Interfaces
|   |   `-- ...
|   |-- components/            # Shared UI Components
|   |-- config/                # App Configuration
|   |-- fullchat/              # Right-Side Chat Panel
|   |   |-- FullChatbar.tsx    # ORCHESTRATOR
|   |   |-- FullChatbarMessages.tsx # Message Rendering
|   |   `-- ...
|   |-- graph/                 # Topology + mapping seam
|   |   |-- springDerivation.ts # Physics mapping seam
|   |   |-- physicsMappingPolicy/ # Edge-type mapping policy layer
|   |   `-- ...
|   |-- physics/               # Core Physics Engine
|   |   |-- engine.ts          # ENGINE STATE
|   |   |-- types.ts           # Physics Types
|   |   |-- engine/            # Sub-systems
|   |   |   |-- engineTick.ts  # MAIN TICK ORCHESTRATOR
|   |   |   |-- engineTickPreflight.ts # Firewalls
|   |   |   |-- forcePass.ts   # Forces
|   |   |   |-- constraints.ts # PBD Constraints
|   |   |   |-- velocity/      # Velocity Modules
|   |   |   |   |-- staticFrictionBypass.ts # Micro-Slip
|   |   |   |   `-- ...
|   |   |   |-- motionPolicy.ts # Threshold Logic
|   |   |   `-- ...
|   |-- playground/            # Main Application Canvas
|   |   |-- rendering/         # Canvas Drawing and Loop
|   |   |   |-- graphRenderingLoop.ts # MAIN RENDER LOOP
|   |   |   |-- renderLoopScheduler.ts # Frame Scheduling
|   |   |   |-- renderLoopPerf.ts      # Perf Telemetry
|   |   |   |-- hoverController.ts     # Interaction Truth
|   |   |   `-- ...
|   |   |-- useGraphRendering.ts # HOOK WIRING
|   |   `-- GraphPhysicsPlayground.tsx # ROOT CONTAINER
|   |-- popup/                 # Node Popups and MiniChat
|   |-- server/                # Backend (Cloud Run service)
|   |-- main.tsx               # Entry Point
|   `-- index.css              # Global Styles
|-- index.html                 # HTML Entry
|-- package.json
`-- tsconfig.json
```

## 2. Top Source Files (By Line Count)
Note: Counts are estimated post-modularization.

1. src/fullchat/FullChatbar.tsx (800+ lines) - Chat Orchestrator
2. src/physics/engine/engineTick.ts (740 lines) - Physics Orchestrator
3. src/playground/rendering/graphRenderingLoop.ts (600+ lines) - Render Loop
4. src/playground/rendering/hoverController.ts (large) - Interaction/HitTest
5. src/physics/engine/constraints.ts (370 lines) - PBD Constraints
6. src/playground/GraphPhysicsPlayground.tsx (378 lines) - Main UI Controller
7. src/physics/engine/engine.ts (300+ lines) - Engine State Container
8. src/physics/engine/forcePass.ts (200 lines) - Forces
9. src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx (312 lines) - Doc Viewer
10. src/playground/rendering/renderLoopScheduler.ts (New) - Loop Logic
11. src/components/GoogleLoginButton.tsx - Google login entry

## 3. Core Runtime Loops

- Physics Loop (engine.tick):
  - Driven by: Scheduler (useGraphRendering.ts).
  - Frequency: 60hz (fixed step).
  - Degrade-1:1: Reduces pass frequency but enforces Hot Pair Fairness (Fix #22).
  - Operations: ForcePass -> Integration -> XPBD Constraints -> Reconcile -> Correction.

- Scheduler (Holy Grail Logic):
  - Driven by: requestAnimationFrame.
  - Accumulator: fixed-step logic (accumulatorMs += frameDeltaMs).
  - Overload Detection: dtHuge (>250ms), missed budgets.
  - Failure Mode: Brief Stutter (Drop Debt).
  - Hysteresis: degradeLevel (1 or 2) for 6-12 frames.

## 4. Invariants (Move-Leak Hardened)

1. Visual Dignity: Prefer stutter over slow motion. Time is 1:1.
2. Zero-Drift Rendering: Camera uses integer snapping and unified transform.
3. Interaction Authority: Dragged nodes are isFixed=true and immune to forces.
   - Warm Release: Releasing a node clears its force history.
   - Knife-Sharp: Drags update instantly (bypassing tick).
4. Interaction Determinism: If it matches visually, it matches logically.
5. No Debt Drift: correctionResidual tracked to resolve unpaid debt.
6. Fixed-Step Stability: Physics runs at 60hz deterministic, decoupled from Render Hz.

## 5. Key Files for Physics Control

- src/playground/useGraphRendering.ts:
  - Overload Monitor: overloadState (active, reason, severity).
  - Debt Dropper: accumulatorMs = 0.
- src/physics/engine.ts:
  - Pass Scheduler: degrade logic.
  - Warm Start: invalidation logic for state changes.
- src/physics/engine/engineTickXPBD.ts:
  - XPBD Solver: iterative edge distance constraints.
- src/playground/rendering/camera.ts:
  - Unified Transform: World <-> Screen mapping.
- src/physics/config.ts:
  - maxPhysicsBudgetMs: hard cap on physics calculation time per frame.
  - dtHugeMs: threshold for tab switch freeze (default 250ms).

## 6. Logs to Watch

- [RenderPerf]: droppedMs, reason (OVERLOAD/BUDGET).
- [FixedLeakWarn]: CRITICAL. Fixed node moved by solver.
- [CorrCap]: Debt stored due to budget clipping.
- [Degrade]: level, passes, budgetMs.
- [Hand]: dragging=Y, localBoost=Y.
- [SlushWatch]: Warnings if debt persists despite drop logic.
