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

### A. The XPBD Solver (Unified)
1.  **Forces (Soft)**: Repulsion, Center Gravity. Drive organic layout.
2.  **XPBD Constraints (Hard)**: Edge Distance solver with Compliance ($\alpha$). Replaces legacy Springs.
3.  **Integration**: Euler integration step ($x' = x + v \Delta t$).
4.  **Reconcile**: Velocity updated from positional corrections ($v = \Delta x / \Delta t$).
5.  **Initialization**: "Spread" strategy seeds nodes to prevent singularities.
6.  **Singularity**: Deterministic overlap resolution ($d \approx 0$).
7.  **Damping (XPBD-Specific)**: XPBD mode uses its own damping policy (`DEFAULT_XPBD_DAMPING = 0.20`, half-life ~0.69s) separate from legacy damping (0.90, half-life ~0.15s). User can override via `config.xpbdDamping` or preset buttons (Snappy/Balanced/Smooth).


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
*   **Concept**: `MotionPolicy` (New) centralized response curves (Degrade vs Temperature).
*   **Bucket A (Sacred)**: Integration, XPBD Solver (Drag), Canvas Release. *Never degraded.*
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
        *   **Numeric Rebase**: "Ghost Energy" is purged by snapping near-zero deltas when calm, preventing infinite drift.
        *   **Cross-Browser Checksum**: Real-time position hash ensures different JS engines produce bit-identical results.

## 4. Interaction Contract (The "King" Layer)
*   **Screen<->World Mapping Contract**:
    *   **Single Truth**: `CameraTransform` + `SurfaceSnapshot` = The only valid conversion.
    *   **Frame Lock**: Input events queue actions. The *Render Loop* executes them using the *Frame's* Snapshot. (No "Live" vs "Render" skew).
    *   **Overlay Glue**: HTML overlays receive their position `(x, y)` from the `graph-render-tick` event, guaranteeing sync with the canvas.
*   **Catastrophic Safety Rails**:
    *   **Last Good Surface**: If browser reports `0x0` rect, we **Freeze**. The canvas is never resized to 0.
    *   **DPR Guard**: If `dpr` is standard, `0`, or `NaN`, we fallback to `1.0` or last known good. 4-frame hysteresis prevents flapping.
    *   **NaN Camera**: Invalid camera math triggers instant rollback to previous valid state.
*   **Perf Cliffs & Detection**:
    *   **O(N) Cliff**: Rendering > 2000 nodes without culling. *Watch*: `[RenderPerf]` frame times.
    *   **GC Cliff**: Allocating objects in `render()`. *Watch*: Heap spikes in DevTools. *Fix*: Use `scratchVec` pools.
    *   **DPR Cliff**: Resizing canvas on high-DPI (4k@2x) is expensive (~15ms). *Mitigation*: Debounce resize events.
*   **Hand Authority**: When dragging a node:
    *   It follows the cursor 1:1 **instantly** (bypasses physics tick for "Knife-Sharp" feel).
    *   **Deferred Anchoring** (Fix #36): Drag start is queued (`setPendingDrag`) and executed at the *start* of the Render Frame.
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
*   **Overlay Input Safety (Non-Negotiable)**:
    *   The Canvas captures `pointerdown` for drag; overlays must explicitly stop propagation.
    *   **Overlay Wrapper**: `pointerEvents: 'auto'` + `onPointerDown={(e) => e.stopPropagation()}`.
    *   **Interactive Children**: Buttons, inputs, and toggles each must stop `pointerdown` as well.
    *   **Backdrop Click-Outside**: Use a full-screen backdrop with `pointerEvents: 'auto'`, `onPointerDown` stop, and `onClick` close.
    *   **Verification**: Always manually verify click, close, and input focus before shipping new overlays.

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
*   **Scheduler Logic**: `src/playground/rendering/renderLoopScheduler.ts` (Loop orchestration).
*   **Pass Scheduling**: `src/physics/engine/engineTick.ts` (Main Physics Tick).
*   **Force Logic**: `src/physics/engine/forcePass.ts` & `src/physics/engine/constraints.ts`.
*   **Velocity/Motion**: `src/physics/engine/velocityPass.ts` & `src/physics/engine/motionPolicy.ts`.
*   **Engine State**: `src/physics/engine.ts`.

## 9. Hover Highlight Render Law
The hover highlight system is a two-pass edge render plus per-dot opacity control. This is the canonical law
for dot hover visuals (match pixels, no ghosting).

### A. Classification Sets
*   **Hovered Dot**: `hoverState.hoveredNodeId` (plus `engine.draggedNodeId`).
*   **Neighbor Dots**: `hoverState.neighborNodeIds` (adjacency map snapshot).
*   **Neighbor Edges**: `hoverState.neighborEdgeKeys` (edge keys derived from hovered dot).

### B. Energy & Timing
*   **`dimEnergy`** transitions via `neighborTransitionMs` (target 100ms).
*   **`dimEnergy`** stays > 0 during fade-out and only clears neighbor sets once it hits ~0.
*   **Non-neighbor opacity** targets `neighborDimOpacity` (0.2 = 20%).

### C. Pass Ordering (Edges → Dots)
1.  **Edges Pass 1**: draw all non-neighbor edges at `dimOpacity`.
2.  **Edges Pass 2**: draw neighbor edges in `neighborEdgeColor` using `dimEnergy` as alpha.
3.  **Dots Pass**: apply `nodeOpacity` per dot (neighbors + hovered remain full opacity).
4.  **Hovered Brighten**: hovered dot gets a brightness boost (~30%) independent of dimming.
