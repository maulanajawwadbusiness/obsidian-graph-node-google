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
3.  `src/playground/GraphPhysicsPlayground.tsx` (378 lines) - **Main UI Controller**
4.  `src/physics/engine/constraints.ts` (372 lines) - **PBD Constraints**
5.  `src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx` (312 lines) - **Doc Viewer UI**
6.  `src/fullchat/FullChatStore.tsx` (227 lines) - **Chat State Manager**
7.  `src/physics/engine/forcePass.ts` (202 lines) - **Force Calculations**
8.  `src/popup/PopupStore.tsx` (157 lines) - **Popup State Manager**
9.  `src/physics/types.ts` (153 lines) - **Physics Type Definitions**
10. `src/ai/paperAnalyzer.ts` (117 lines) - **AI Analysis Pipeline**

## 3. Core Runtime Loops

*   **Physics Loop (`engine.tick`)**:
    *   **Driven By**: Scheduler (`useGraphRendering.ts`).
    *   **Frequency**: 60hz (fixed step).
    *   **Degrade-1:1**: Reduces pass frequency (e.g. 1/2 or 1/3 rate) based on scheduler's `degradeLevel`.
    *   **Operations**: `ForcePass` -> `Integration` -> `Constraints`.

*   **Scheduler ("Holy Grail" Logic)**:
    *   **Driven By**: `requestAnimationFrame`.
    *   **Accumulator**: Fixed-step logic (`accumulatorMs += frameDeltaMs`).
    *   **Overload Detection**: Detects `dtHuge` (>250ms), missed budgets, or persistent debt.
    *   **Failure Mode**: **Brief Stutter (Drop Debt)**. If behind, it *deletes* `accumulatorMs` instead of "syruping" (slow motion).
    *   **Hysteresis**: Triggers `degradeLevel` (1 or 2) for 6-12 frames to recover breath.

## 4. Invariants

1.  **Visual Dignity**: Prefer stutter (teleport) over slow motion. Time is 1:1.
2.  **Interaction Authority**: Dragged nodes are `isFixed=true` and match cursor 1:1.
    *   **Local Boost**: Dragging wakes neighbors and forces high-priority physics for the local cluster, even in degrade mode.
3.  **No Syrup**: Debt (`accumulatorMs`) is never carried > 1 frame if it exceeds the step budget.
4.  **Degrade-1:1**: When stressed, we skip *entire passes* (e.g. spacing frame 2 of 3) rather than reducing stiffness (which would create "mud").

## 5. Key Files for Physics Control

*   `src/playground/useGraphRendering.ts`:
    *   **Overload Monitor**: `overloadState` (active, reason, severity).
    *   **Debt Dropper**: Logic to `accumulatorMs = 0` on freeze/watchdog.
    *   **Degrade Setter**: Pushes `degradeLevel` to `engine`.
*   `src/physics/engine.ts`:
    *   **Pass Scheduler**: `repulsionEvery`, `spacingEvery` derived from `degradeLevel`.
    *   **Local Boost**: `focusActive` list bypasses degrade limits for interaction.
*   `src/physics/config.ts`:
    *   `maxPhysicsBudgetMs`: Hard cap on physics calculation time per frame.
    *   `dtHugeMs`: Threshold for "tab switch" freeze (default 250ms).

## 6. Logs to Watch

*   `[RenderPerf]`: `droppedMs` (stutter magnitude), `fps`, `ticksPerSecond`.
*   `[Overload]`: `active=true`, `reason=BUDGET_EXCEEDED`, `severity=SOFT/HARD`.
*   `[Degrade]`: `level=1`, `passes={repel:Y, space:N}`, `budgetMs`.
*   `[Hand]`: `dragging=Y`, `localBoost=Y`, `lagP95Px` (Target: 0.00).
*   `[SlushWatch]`: Warnings if debt persists despite drop logic.
