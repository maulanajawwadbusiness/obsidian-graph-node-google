# Arnvoid System Documentation

## 1. Introduction
**Arnvoid** is a conversational graph interface designed for deep reasoning over complex knowledgebases. It acts as a "thinking partner" that lives inside the user's obsidian graph, providing context-aware synthesis and exploration.

The core flow is the **Paper Essence Pipeline**:
`Document (PDF/MD/TXT) -> AI Paper Analyzer -> 5 Key Nodes + Node Knowledge (Title/Summary) -> Interactive Graph -> Contextual Chat`.

## 2. UI Surface Map & Ownership

The application layers, ordered by z-index (lowest to highest):

1.  **The Canvas (Graph substrate)**
    *   **Rule**: Never under-reacts. If a panel or overlay is active, the canvas underneath MUST NOT receive pointer/wheel events.
    *   Owned by: `PhysicsEngine`.

2.  **Top-Left Brand (`BrandLabel`) & Bottom-Center Title (`MapTitleBlock`)**
    *   Subtle UI markers tied to the current document state.
    *   `MapTitleBlock` shows "Peta Pengetahuan 2D" and the AI-inferred title.
    *   **Rule**: `pointer-events: none` ensures they never steal clicks from the graph.

3.  **Node Popups (Context)**
    *   Floating cards appearing on node interaction. Entry point for MiniChat.
    *   Owned by: `PopupStore`.

4.  **Mini Chat (Quick Context)**
    *   Lightweight chat window attached to Node Popups.
    *   **Brain**: `PopupStore` wires this to real AI context.
    *   **Handoff**: Graduates conversation to Full Chat while preserving Node Knowledge.

5.  **Full Chatbar (Deep Reasoning)**
    *   Right-side panel for long-form synthesis.
    *   **Ownership**: Consumes all interaction within its bounds.
    *   Owned by: `FullChatStore`.

6.  **Analysis Overlay (`AnalysisOverlay`)**
    *   **Highest Layer**. Dims the screen during AI parsing/analysis.
    *   **Shielding Rule**: Blocks all pointer, wheel, and touch events to prevent graph disturbance during critical AI operations.

## 3. Physics Architecture And Contract
The graph is driven by a **Hybrid Solver** (`src/physics/`) prioritizing "Visual Dignity" over pure simulation accuracy.

### A. The Hybrid Solver
1.  **Forces (Soft)**: Repulsion, Springs, Center Gravity. Drive organic layout.
2.  **PBD Constraints (Hard)**: Position-Based Dynamics for Non-Penetration (`applySafetyClamp`) and Spacing.
3.  **Diffusion**: Inertia relaxation and phase diffusion to kill "boiling" energy in dense clusters.
4.  **Drift**: Buoyancy and slight center pull to keep unconnected nodes visible.

### B. Performance Doctrine (The Sacred 60)
**"Interaction > Simulation"**

#### 1. The Holy Grail Scheduler (0-Slush)
*   **Timebase**: Time matches reality 1:1. We never "stretch" time to catch up ("Syrup" is forbidden).
*   **Overload Failure Mode**: **Brief Stutter (Drop Debt)**.
    *   If the renderer falls behind (`accumulator > budget`), we **delete** the debt.
    *   The graph teleports to the present moment. Stutter is acceptable; slow-motion is not.
    *   **Triggers**: `DT_HUGE` (>250ms), `DEBT_WATCHDOG`, `BUDGET_EXCEEDED`.

#### 2. Degrade-1:1 Policy ("No Mud")
When stressed (`degradeLevel > 0`), we reduce workload by **skipping entire passes**, NOT by weakening forces.
*   **Bucket A (Sacred)**: Integration, Dragged Node Physics (Local Boost), Canvas Release. *Never degraded.*
*   **Bucket B (Structural)**: Springs, Repulsion. *Frequency reduced (1:2, 1:3) but stiffness normalized to dt.*
*   **Bucket C (Luxury)**: Far-field Spacing, Deep Diffusion. *Aggressively throttled.*
*   **Fix #22 (Fairness)**: "Hot Pairs" (pairs under pressure) are prioritized 1:1 even in degraded mode to prevent far-field crawl.

### C. Move-Leak Hardening (Invariants)
Post-Fixes #01–#22, the system guarantees:

1.  **Render Correctness**:
    *   **Unified Transform**: `CameraTransform` singleton ensures Input and Render matrices are identical.
    *   **Dual-Space Rendering**:
        *   **World Space**: Grid/Debug (Camera Matrix).
        *   **Manual Projection**: Nodes/Links (Identity Matrix + `worldToScreen`). Allows for sub-pixel stroke alignment.
    *   **Gradient Glow**: GPU-optimized radial gradients replace CSS/Canvas filters for 144Hz performance.
    *   **Deadzone**: Motions < 0.5px are ignored to prevent sub-pixel drift.
    *   **Visual Stability (Hysteresis)**:
        *   **Motion**: Snapping DISABLED for sub-pixel smooth panning/zooming.
        *   **Rest**: Snapping ENABLED after 150ms idle to lock content to integer device pixels (Crisp Edges).

2.  **Physics Authority**:
    *   **Absolute Fixed**: `isFixed` nodes (dragged) are immune to diffusion/forces.
    *   **Atomic Cleanup**: Drag release, mode switches, and topology changes trigger **Warm Start Invalidation** (clearing `prevFx`, `lastDir`, `correctionResidual`).
    *   **No Debt Drift**: Constraint budget clipping forces `correctionResidual` tracking (Fix #17), ensuring unpaid debt is eventually resolved rather than discarded (prevents "Eternal Crawl").

3.  **Stability Subsystems**:
    *   **Sleep**: Nodes cannot sleep if constraint pressure > 0.1px.
    *   **Mode Ramps**: Switching modes (Normal <-> Stressed) smoothly ramps budgets and clears residuals to prevent "Law Jump" pops.
    *   **Degeneracy**: Triangle area forces ramp down to 0 if area < 5.0 to prevent gradient explosions.
    *   **Coherence**: DT Skew is disabled (`skew=0`) by default to prevent cluster drift.
    *   **Interaction Determinism**:
        *   **Z-Order Truth**: Picking logic (`hoverController`) strictly respects draw order (Last=Top wins).
        *   **Hitbox Truth**: Visual radius (with glow) equals touch radius. Labels have bounding boxes.
        *   **Gesture Truth**: Click vs Drag is resolved by a 5px threshold (No accidental micromoves).

## 4. Interaction Contract (The "King" Layer)
*   **Hand Authority**: When dragging a node:
    *   It follows the cursor 1:1 **instantly** (bypasses physics tick for "Knife-Sharp" feel).
    *   **Deferred Anchoring** (Fix #36): Drag start is queued (`setPendingDrag`) and executed at the *start* of the Render Frame to ensure Camera/Input synchronization.
    *   **Immutable Physics Object**: `isFixed=true` via `engine.grabNode`.
*   **Capture Safety**: Centralized `safeEndDrag` handles `pointerup`, `cancel`, `lostcapture`, and `window.blur` to prevent stuck drags.
*   **Input Hygiene**:
    *   **Sampling**: Pointer events write to `SharedPointerState`.
    *   **Processing**: `render()` loop reads `SharedPointerState` to update physics/hover.
    *   **Wheel Ownership**: `passive: false` + `preventDefault` prevents browser zoom/scroll conflicts.
    *   **OS Normalization**: Wheel deltas are clamped (`+/- 150`) to handle Windows/Mac variance.
    *   **Inertia Killer**: Small deltas (`< 4.0`) are ignored to strictly eliminate trackpad drift tails.
*   **Overlay Coherence**:
    *   **Shared Snapshot**: Graph broadcasts `transform`, `dpr`, and `snapEnabled` via `graph-render-tick`.
    *   **Unified Rounding**: Popups match Canvas snapping (Float on move, Int on rest).
*   **Layout Safety**: `ResizeObserver` caches rects to prevent layout thrash.
*   **DPR Stability**: Rapid monitor swaps are stabilized via hysteresis (4-frame debounce).

## 5. AI Architecture
Arnvoid uses a unified AI layer (`src/ai/`) that abstracts provider details behind a strict interface.

### A. The Core: `LLMClient`
*   **Contract**: All features talk to `LLMClient` (`generateText`, `generateTextStream`, `generateStructured`).
*   **Provider Agnostic**: The application logic does not know if it's talking to OpenAI, OpenRouter, or a local model.

### B. Current State
*   **Primary**: `OpenAIClient` using the **Responses API** (`v1/responses`).
*   **Behavior Doctrine**:
    *   **Fake Streaming**: Client-side character ticking (15ms) used where backend streaming is unavailable.
    *   **Abort Model**: Every AI loop uses an `AbortController`.

## 6. Context Doctrine
Intelligence is relative to context. We maintain three levels:
1.  **Node Knowledge**: A node's `sourceTitle` and `sourceSummary`.
2.  **Document Context**: The full `documentText`.
3.  **Handoff Context**: When moving from Mini -> Full, `pendingContext` preserves specific node knowledge.

## 7. Telemetry & Logs (Debug Keys)
Enable `debugPerf: true` in `config.ts` to see:

*   **Scheduler & Overload**:
    *   `[RenderPerf]`: `droppedMs`, `reason` (OVERLOAD/BUDGET/FREEZE), `tickMs`.
    *   `[Overload]`: `active`, `reason`, `severity` (SOFT/HARD).
    *   `[SlushWatch]`: **CRITICAL**. Warns if debt persists despite drop logic (Reset failure).
*   **Physics Loop & Degrade**:
    *   `[Degrade]`: `level` (0-2), `passes={repel:Y, space:N}`, `budgetMs`.
    *   `[Hand]`: `localBoost=Y`, `lagP95Px` (Target: 0.00).
    *   `[PhysicsPasses]`: Breakdown of ms per pass.
    *   `[Impulse]`: Logged on trigger or rejection (Cooldown/Drag).
    *   `[RenderDrift]`: Logged if micro-drift is active.
*   **Lifecycle**:
    *   `[PhysicsMode]`: Transitions (Normal -> Stressed).

## 8. Where to Edit (Entrypoints)
*   **Scheduler Logic**: `src/playground/rendering/graphRenderingLoop.ts` (Look for `runPhysicsScheduler`, `render` loop).
*   **Pass Scheduling**: `src/physics/engine/engineTick.ts` (Look for `runPhysicsTick`).
*   **Force Logic**: `src/physics/engine/forcePass.ts`.
*   **Constraint Logic**: `src/physics/engine/constraints.ts`.
