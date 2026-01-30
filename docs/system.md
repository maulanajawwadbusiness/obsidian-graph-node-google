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
*   **0-Slush Scheduler**: Time must remain 1:1 with reality.
    *   **Overload Mode**: If the renderer falls behind (accumulator > budget), we **Drop Debt** (Stutter) rather than "Syrup" (Slow Motion).
    *   **Rule**: `accumulatorMs` is hard-reset if it exceeds `maxStepsPerFrame` capacity. 
*   **Bounded Work**: Cost per frame is capped regardless of N.
    *   **Edge Case 01 (O(N²))**: Fixed by prime-modulo strided sampling (`pairwiseMaxChecks`).
    *   **Edge Case 02 (Dense Balls)**: Fixed by `maxCorrectionPerFrame` budgets and inertia dampeners.
    *   **Edge Case 03 (Cascades)**: Fixed by energy gating and phase staggering (Repulsion/Spacing run on different frames).

### C. Time Consistency (dt-Normalization)
*   **Stiffness Invariance**: Spring strength and damping are normalized against `dt` so behavior doesn't change at 30fps vs 120fps.
*   **Correction Budgets**: Non-linear constraints use `timeScale` derived from `dt` to ensure consistent convergence speed.

### D. Adaptive Operating Envelope
The engine shifts modes based on Node count (N) and Edge count (E):
*   **Normal**: Full fidelity (60hz).
*   **Stressed** (N>250): Spacing pass throttled.
*   **Emergency** (N>500): Springs staggered, angular resistance simplified.
*   **Fatal** (N>900): Heavy passes disabled to preserve app survival.

## 4. Interaction Contract
*   **Hand Authority**: When dragging a node, it must follow the cursor 1:1. Physics ignores mass/forces for the dragged node (`isFixed=true`).
*   **Wake Propagation**: Interaction wakes up the local cluster ("Wake-on-Drag") to allow natural settling, but not the entire graph.
*   **Input Ownership**: UI panels (Chat, Docs) fully consume pointer events. The graph does not pan/zoom when you scroll a chat window.

## 5. AI Architecture

Arnvoid uses a unified AI layer (`src/ai/`) that abstracts provider details behind a strict interface.

### A. The Core: `LLMClient`
*   **Contract**: All features (Chat, Prefill, Analyzer) talk to the `LLMClient` interface (`generateText`, `generateTextStream`, `generateStructured`).
*   **Provider Agnostic**: The application logic does not know if it's talking to OpenAI, OpenRouter, or a local model.
*   **Factory**: `createLLMClient` in `src/ai/index.ts` determines the implementation based on config.

### B. Current State
*   **Primary**: `OpenAIClient` using the **Responses API** (`v1/responses`) for text and streaming.
*   **Behavior Doctrine**:
    *   **Mode Switch**: `VITE_AI_MODE='real'` vs `'mock'`.
    *   **Abort Model**: Every AI loop uses an `AbortController`. Quick kill on navigation.
    *   **Fake Streaming**: Client-side character ticking (15ms) used where backend streaming is unavailable.

## 6. Context Doctrine
Intelligence is relative to context. We maintain three levels:
1.  **Node Knowledge**: A node's `sourceTitle` and `sourceSummary` generated by the analyzer. Lives in `node.meta`.
2.  **Document Context**: The full `documentText` and metadata held in `DocumentStore`.
3.  **Handoff Context**: When moving from Mini -> Full, the `pendingContext` object preserves history + specific node knowledge so the reasoning is coherent.

## 7. Telemetry & Logs (Debug Keys)
Enable `debugPerf: true` in `config.ts` to see:

*   **Render/Scheduler**:
    *   `[RenderPerf]`: `droppedMs` (stutter events), `ticksPerSecond`, `avgTickMs`.
    *   `reason=OVERLOAD`: Indicates frame deadline missed and debt dropped.
*   **Physics Loop**:
    *   `[PhysicsPerf]`: Breakdown of ms per pass (Repulsion, Spacing, Springs).
    *   `[PhysicsSlushWarn]`: **CRITICAL**. Indicates accumulator backlog warning (potential syrup).
*   **Lifecycle**:
    *   `[PhysicsMode]`: Transitions (Normal -> Stressed).
    *   `[PhysicsTopology]`: Links dropped due to density caps.
