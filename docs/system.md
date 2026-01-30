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

## 3. Physics Architecture & Contract
The graph is driven by a **Hybrid Solver** (`src/physics/`) prioritizing "Visual Dignity" over pure simulation accuracy.

### A. The Hybrid Solver
1.  **Forces (Soft)**: Repulsion, Springs, Center Gravity. Drive organic layout.
2.  **PBD Constraints (Hard)**: Position-Based Dynamics for Non-Penetration (`applySafetyClamp`) and Spacing.
3.  **Diffusion**: Inertia relaxation and phase diffusion to kill "boiling" energy in dense clusters.
4.  **Drift**: Buoyancy and slight center pull to keep unconnected nodes visible.

### B. Performance Doctrine (The Sacred 60)
**"Interaction > Simulation"**

#### 1. The Holy Grail Scheduler (0-Slush)
*   **Timebase**: Time matches reality 1:1. We never "stretch" time to catch up ("Syrup").
*   **Overload Failure Mode**: **Brief Stutter (Drop Debt)**.
    *   If the renderer falls behind (`accumulator > budget`), we **delete** the debt.
    *   The graph teleports to the present moment. Stutter is acceptable; slow-motion is not.
    *   **Triggers**:
        *   `DT_HUGE` (>250ms, e.g. tab switch) -> Instant Freeze (1-frame).
        *   `DEBT_WATCHDOG` (Debt persists > 2 frames) -> Hard Drop.
        *   `BUDGET_EXCEEDED` (Physics took too long) -> Soft Drop.

#### 2. Degrade-1:1 Policy ("No Mud")
When stressed (`degradeLevel > 0`), we reduce workload by **skipping entire passes**, NOT by weakening forces (which creates "mud").
*   **Bucket A (Sacred)**: Integration, Dragged Node Physics (Local Boost), Canvas Release. *Never degraded.*
*   **Bucket B (Structural)**: Springs, Repulsion. *Frequency reduced (1:2, 1:3) but stiffness normalized to dt.*
*   **Bucket C (Luxury)**: Far-field Spacing, Deep Diffusion. *Aggressively throttled or disabled.*

### C. Time Consistency (dt-Normalization)
*   **Stiffness Invariance**: Spring strength and damping are normalized against `dt`. A simulation running at 30hz (degrade level 2) has the same structural stiffness as 60hz, just choppier updates.

### D. Adaptive Operating Envelope
The engine shifts modes based on Node count (N) and Edge count (E):
*   **Normal**: Full fidelity (60hz).
*   **Stressed** (N>250): Spacing pass throttled.
*   **Emergency** (N>500): Springs staggered, angular resistance simplified.
*   **Fatal** (N>900): Heavy passes disabled to preserve app survival.

## 4. Interaction Contract
*   **Hand Authority**: When dragging a node, it must follow the cursor 1:1. Physics ignores mass/forces for the dragged node (`isFixed=true`).
*   **Local Boost (Interaction Bubble)**: Dragging a node wakes its neighbors and forces them into **Bucket A** (Full Physics). The local cluster stays fluid even if the global graph is stuttering under load.
*   **Input Ownership**: UI panels (Chat, Docs) fully consume pointer events.

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
    *   `[PhysicsPerf]`: Breakdown of ms per pass.
*   **Lifecycle**:
    *   `[PhysicsMode]`: Transitions (Normal -> Stressed).

## 8. Where to Edit (Entrypoints)
*   **Scheduler Logic**: `src/playground/useGraphRendering.ts` (Look for `render` loop, `overloadState`).
*   **Pass Scheduling**: `src/physics/engine.ts` (Look for `tick`, `setDegradeState`).
*   **Force Logic**: `src/physics/engine/forcePass.ts`.
*   **Constraint Logic**: `src/physics/engine/constraints.ts`.
