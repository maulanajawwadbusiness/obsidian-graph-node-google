# Repository X-Ray: Arnvoid

**Generated for External AI Context Loading**
**Target**: Deep Codebase Understanding without Repo Access
**Date**: 2026-01-30

## 1. Repository Tree (Depth 4)
Excluding: `node_modules`, `dist`, `build`, `.git`

```
.
├── docs/                      # Extensive system documentation
│   ├── system.md              # MAIN SYSTEM DOC
│   ├── physics_xray.md        # PHYSICS DOCTRINE
│   └── ... (forensic reports)
├── src/
│   ├── ai/                    # AI Layer (Provider Agnostic)
│   │   ├── clientTypes.ts     # Interfaces
│   │   ├── paperAnalyzer.ts   # Document Analysis Logic
│   │   └── ...
│   ├── ArnvoidDocumentViewer/ # PDF/Doc Viewer Module
│   │   ├── engines/
│   │   ├── hooks/
│   │   └── ArnvoidDocumentViewer.tsx
│   ├── components/            # Shared UI Components
│   │   ├── AnalysisOverlay.tsx
│   │   ├── BrandLabel.tsx
│   │   └── ...
│   ├── config/                # App Configuration
│   │   ├── aiModels.ts
│   │   └── ...
│   ├── document/              # Document Parsing & Workers
│   │   ├── parsers/
│   │   └── ...
│   ├── fullchat/              # Right-Side Chat Panel
│   │   ├── FullChatStore.tsx
│   │   └── ...
│   ├── physics/               # Core Physics Engine
│   │   ├── engine/            # Sub-systems (constraints, forces)
│   │   ├── types.ts           # Physics Types
│   │   ├── engine.ts          # MAIN CLASS & DEGRADE LOGIC
│   │   └── ...
│   ├── playground/            # Main Application Canvas
│   │   ├── rendering/         # Canvas Drawing
│   │   ├── components/        # Canvas-overlay components
│   │   ├── useGraphRendering.ts # SCHEDULER & OVERLOAD DETECT
│   │   └── GraphPhysicsPlayground.tsx # ROOT CONTAINER
│   ├── popup/                 # Node Popups & MiniChat
│   │   ├── PopupStore.tsx
│   │   └── ...
│   ├── main.tsx               # Entry Point
│   └── index.css              # Global Styles
├── index.html                 # HTML Entry
├── package.json
└── tsconfig.json
```

## 2. Top Source Files (By Line Count)
*Note: Counts are based on specific file scan.*

1.  `src/physics/engine.ts` (950+ lines) - **Core Physics Logic & Degrade State**
2.  `src/playground/useGraphRendering.ts` (600+ lines) - **Scheduler & Overload Controller**
3.  `src/physics/engine/constraints.ts` (372 lines) - **PBD Constraints & Spacing**
4.  `src/playground/GraphPhysicsPlayground.tsx` (378 lines) - **Main UI Controller**
5.  `src/physics/engine/integration.ts` (200+ lines) - **Time Steps & Dt Skew**
6.  `src/physics/engine/corrections.ts` (170+ lines) - **Diffusion & Jitter Control**
7.  `src/physics/engine/velocity/dragVelocity.ts` (40 lines) - **Critical Interaction Logic**
8.  `src/playground/rendering/camera.ts` (New) - **Render Authority & Unified Transform**
9.  `src/physics/engine/forcePass.ts` (202 lines) - **Force Calculations**
10. `src/fullchat/FullChatStore.tsx` (227 lines) - **Chat State Manager**
11. `src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx` (312 lines) - **Doc Viewer UI**

## 3. Core Runtime Loops

*   **Physics Loop (`engine.tick`)**:
    *   **Driven By**: Scheduler (`useGraphRendering.ts`).
    *   **Frequency**: 60hz (fixed step).
    *   **Degrade-1:1**: Reduces pass frequency but enforces **Hot Pair Fairness** (Fix #22) to prevent far-field crawl.
    *   **Operations**: `ForcePass` -> `Integration` -> `Constraints` -> `Correction`.

*   **Scheduler ("Holy Grail" Logic)**:
    *   **Driven By**: `requestAnimationFrame`.
    *   **Accumulator**: Fixed-step logic (`accumulatorMs += frameDeltaMs`).
    *   **Overload Detection**: Detects `dtHuge` (>250ms), missed budgets.
    *   **Failure Mode**: **Brief Stutter (Drop Debt)**.
    *   **Hysteresis**: Triggers `degradeLevel` (1 or 2) for 6-12 frames.

## 4. Invariants (Move-Leak Hardened)

1.  **Visual Dignity**: Prefer stutter over slow motion. Time is 1:1.
2.  **Zero-Drift Rendering**: Camera uses integer snapping and unified transform. No sub-pixel creep.
3.  **Interaction Authority**: Dragged nodes are `isFixed=true` and immune to simulation forces.
    *   **Warm Release**: Releasing a node atomically clears its force history.
4.  **No Debt Drift**: Clipped budgets store `correctionResidual` to ideally resolving error over time.
5.  **Fixed-Step Stability**: Physics runs at 60hz deterministic, decoupled from Render Hz.

## 5. Key Files for Physics Control

*   `src/playground/useGraphRendering.ts`:
    *   **Overload Monitor**: `overloadState` (active, reason, severity).
    *   **Debt Dropper**: Logic to `accumulatorMs = 0`.
*   `src/physics/engine.ts`:
    *   **Pass Scheduler**: Global degrade logic.
    *   **Warm Start**: Invalidation logic for state changes.
*   `src/playground/rendering/camera.ts`:
    *   **Unified Transform**: Source of truth for World<->Screen mapping.
*   `src/physics/config.ts`:
    *   `maxPhysicsBudgetMs`: Hard cap on physics calculation time per frame.
    *   `dtHugeMs`: Threshold for "tab switch" freeze (default 250ms).

## 6. Logs to Watch

*   `[RenderPerf]`: `droppedMs`, `reason` (OVERLOAD/BUDGET).
*   `[FixedLeakWarn]`: **CRITICAL**. Fixed node moved by solver (Bug).
*   `[CorrCap]`: Debt stored due to budget clipping.
*   `[Degrade]`: `level`, `passes`, `budgetMs`.
*   `[Hand]`: `dragging=Y`, `localBoost=Y`.
*   `[SlushWatch]`: Warnings if debt persists despite drop logic.
