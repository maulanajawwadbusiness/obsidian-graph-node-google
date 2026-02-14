# Arnvoid System Documentation

## 1. Introduction
**Arnvoid** is a conversational graph interface designed for deep reasoning over complex knowledgebases. It acts as a "thinking partner" that lives inside the user's obsidian graph, providing context-aware synthesis and exploration.

The core flow is the **Paper Essence Pipeline**:
`Document (PDF/MD/TXT) -> AI Paper Analyzer -> Key Dots + Directed Links + Node Knowledge -> Interactive Graph -> Contextual Chat`.

## 1.1 ASCII Only
Use pure ASCII characters in code, comments, logs, and documentation. Avoid Unicode arrows, ellipses, and typographic dashes to prevent mojibake.

## 2. UI Surface Map & Ownership

The application layers, ordered by z-index (lowest to highest):

0.  **Onboarding Shell (Pre-Graph Startup Flow)**
    *   Active only before `screen === 'graph'` in `src/screens/AppShell.tsx`.
    *   Flow state machine: `welcome1 -> welcome2 -> prompt -> graph`.
    *   Env gate: `ONBOARDING_ENABLED` (`src/config/env.ts`):
        *   `false` or not set: app starts directly in `graph`.
        *   `true` or `1`: app starts in `welcome1`.
    *   Dev start override: `VITE_ONBOARDING_START_SCREEN` (`src/config/env.ts`):
        *   Canonical values: `welcome1`, `welcome2`, `prompt`, `graph`.
        *   Legacy aliases: `screen1`, `screen2`, `screen3`, `screen4`.
        *   Applies in DEV only. Invalid values fall back to `welcome1` and emit a single DEV warning.
    *   Persistence is currently disabled (`PERSIST_SCREEN = false`), so refresh resets onboarding to `welcome1` when onboarding is enabled.
    *   Graph isolation contract: `GraphPhysicsPlayground` (thin wrapper) is lazy-loaded and mounted only when `screen === 'graph'`, then delegates to `GraphPhysicsPlaygroundContainer` in `src/playground/modules/GraphPhysicsPlaygroundContainer.tsx`. This keeps physics/rendering inactive during onboarding screens.
    *   Money overlays mount only on `prompt` and `graph` screens:
        *   `ShortageWarning`
        *   `MoneyNoticeStack`
        *   `BalanceBadge` on `graph` by default, and on `prompt` only when enabled by UI flags.

1.  **The Canvas (Graph substrate)**
    *   **Rule**: Never under-reacts. If a panel or overlay is active, the canvas underneath MUST NOT receive pointer/wheel events.
    *   **Cursor Contract (Graph Screen)**:
        *   Empty graph space: `cursor: default`
        *   Hovering a Dot: `cursor: pointer`
        *   Active Dot drag: `cursor: grabbing`
        *   Cursor state is derived from render-loop hover/drag truth and must not be hardcoded as a static hand cursor on the full graph container.
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

## 2.1 Onboarding Screens (Purpose and Role)

The onboarding screens live in `src/screens/` and are orchestrated by `AppShell`.

### A. `Welcome1` (`src/screens/Welcome1.tsx`)
*   **Purpose**: Fast brand/splash introduction before the manifesto and prompt screen.
*   **Behavior**:
    *   Auto-advances using `ONBOARDING_SPLASH_MS` (default 4500ms, min 500ms).
    *   Shows fullscreen consent prompt with explicit action buttons. Fullscreen entry is explicit-only (`Yes, activate`).
    *   Shows `FullscreenButton` so user can manually enter/exit fullscreen when overlays are not active.
    *   The consent prompt backdrop is fixed full-viewport and blocks underlying onboarding chrome input.
*   **Role in flow**: Entry screen. `onNext` goes to `welcome2`.

### B. `Welcome2` (`src/screens/Welcome2.tsx`)
*   **Purpose**: Manifesto/motivation copy before user reaches the prompt/auth gate.
*   **Behavior**:
    *   Renders timeline-driven typed manifesto text (deterministic elapsed-time model).
    *   Source text uses embedded `{p=###}` markers and is stripped to render-safe text in the timeline builder.
    *   Cadence is centralized in `src/config/onboardingCadence.ts` and includes punctuation, newline, paragraph, and semantic pauses.
    *   Semantic cadence is applied as distributed pauses around word ends and sentence landings (not tick-per-char jitter).
    *   Cursor uses shared `TypingCursor` component with phase-driven mode mapping.
    *   No fixed auto-advance timer is authoritative for typed completion; timing truth comes from `BuiltTimeline.totalMs`.
    *   Exposes `Back` (to `welcome1`) and `Skip` (to `graph`) actions.
*   **Role in flow**: Transitional explanation screen before `prompt`.

## 2.2 Welcome2 Typing Dataflow (Current)
Current end-to-end flow for manifesto typing:

`MANIFESTO_TEXT -> buildWelcome2Timeline(rawText, cadence) -> BuiltTimeline(events, renderText, totalMs) -> useTypedTimeline(rAF + elapsed) -> visibleText + TypingCursor`

Core files:
- `src/screens/welcome2ManifestoText.ts`
- `src/config/onboardingCadence.ts`
- `src/screens/welcome2Timeline.ts`
- `src/hooks/useTypedTimeline.ts`
- `src/components/TypingCursor.tsx`
- `src/screens/Welcome2.tsx`

Debug toggles:
- `?debugType=1` for runtime typing metrics summary.
- `?debugCadence=1` for semantic/cadence proof logs during timeline build.

### C. `EnterPrompt` (`src/screens/EnterPrompt.tsx`)
*   **Purpose**: Prompt-stage shell that combines:
    *   `PromptCard` (headline, input, attachments, send control).
    *   `FullscreenButton` (rendered by `AppShell` as onboarding chrome).
    *   Optional `PaymentGopayPanel` (top-right launcher/panel).
    *   `LoginOverlay` auth gate.
*   **Behavior**:
    *   Reads auth state from `useAuth()`.
    *   Payment panel visibility is controlled by `SHOW_ENTERPROMPT_PAYMENT_PANEL` in `src/config/onboardingUiFlags.ts`.
    *   `LoginOverlay` is currently feature-gated off in EnterPrompt (`LOGIN_OVERLAY_ENABLED = false`).
    *   When enabled, `LoginOverlay` blocks pointer/wheel interaction and locks page scroll while open.
    *   Continue button in LoginOverlay is a non-functional formal control (no click handler). Auth flow proceeds via session state update after sign-in.
    *   Login debug/error text is hidden by default in dev and visible by default in prod. Dev override: `VITE_SHOW_LOGIN_DEBUG_ERRORS=1`.
*   **Role in flow**:
    *   `onEnter` moves to `graph` (authenticated continue path).
    *   `onSkip` can also move to `graph` (bypass path).
    *   `onBack` returns to `welcome2`.

## 2.3 Onboarding Fullscreen Safety (Current)
Current fullscreen rules in onboarding:

1. Fullscreen is explicit-only:
   - Allowed from fullscreen consent button in Welcome1.
   - Allowed from dedicated fullscreen icon button.
2. Generic background click/keydown in onboarding must never call fullscreen.
3. Overlay precedence:
   - Welcome1 prompt overlay is a top-layer blocker.
   - EnterPrompt LoginOverlay is also a blocker only when the overlay feature is enabled and open.
   - While these overlays are open, fullscreen icon input is blocked.

## 2.4 Persistent Sidebar Sessions (Current)
Saved interfaces in the left Sidebar are now local-first and AppShell-owned.

Current behavior:
- Source of truth:
  - Store module: `src/store/savedInterfacesStore.ts`
  - Versioned key: `arnvoid_saved_interfaces_v1` (guest/offline default)
  - Auth namespace key: `arnvoid_saved_interfaces_v1_user_<user>`
  - Active key is selected by AppShell based on auth state.
- Sidebar list:
  - AppShell loads and maps saved records into Sidebar rows.
  - Sidebar renders provided order and does not apply additional sorting.
- Create:
  - analysis success path persists a saved interface record with full payload.
- Restore:
  - selecting a saved interface sets pending restore intent and graph consumes it once.
  - when selected from prompt screen, AppShell transitions to graph and restore runs on mount.
- Rename:
  - inline rename UX in Sidebar; persisted through AppShell to storage helper.
  - rename does not reorder list (title patch does not bump `updatedAt`).
- Delete:
  - row menu delete opens AppShell-level centered confirm modal.
  - confirm removes record from local storage and refreshes Sidebar immediately.
  - if pending restore intent matches deleted id, it is cleared.
- Search:
  - Sidebar "Search Interfaces" opens centered AppShell overlay.
  - Filter is in-memory from AppShell `savedInterfaces` (no localStorage reads per keystroke).
  - Overlay is shielded so pointer and wheel never leak to canvas.
- Disabled state:
  - when Sidebar is disabled (graph loading), row menu actions are non-actionable.

Saved interface payload contract (full, non-trimmed):
- Record shape: `SavedInterfaceRecordV1` in `src/store/savedInterfacesStore.ts`
- Must preserve:
  - `parsedDocument` including full `text`, `sourceType`, `fileName`, `meta`, and parser warnings/errors if present
  - full `topology`
  - `layout.nodeWorld` + `layout.camera`
  - `analysisMeta.nodesById` summaries (`sourceTitle`, `sourceSummary`)
  - payload timestamps (`createdAt`, `updatedAt`)
- Ordering truth:
  - Sidebar order is based on payload `updatedAt` (then `createdAt`) from the saved record.
  - DB row `updated_at` is metadata only and must not be used for UI ordering.
  - Rename and layout patch paths are hardened to avoid unintended reorder.

Remote memory (account-backed):
- Backend table: `public.saved_interfaces` (Postgres), keyed by authenticated `user_id`.
- Migration: `src/server/migrations/1770383000000_add_saved_interfaces.js`
- Schema summary:
  - `id` bigserial PK
  - `user_id` bigint FK -> `users(id)` ON DELETE CASCADE
  - `client_interface_id` text not null
  - `title` text not null
  - `payload_version` integer not null default 1
  - `payload_json` jsonb not null
  - `created_at`, `updated_at` timestamptz defaults
- Constraints and indexes:
  - unique `(user_id, client_interface_id)`
  - index `(user_id, updated_at desc)`
  - index `(user_id, title)`
- API routes (requireAuth):
  - `GET /api/saved-interfaces`
  - `POST /api/saved-interfaces/upsert`
  - `POST /api/saved-interfaces/delete`
- Payload size limit:
  - server guard constant `MAX_SAVED_INTERFACE_PAYLOAD_BYTES` (default 15 MB) in `src/server/src/serverMonolith.ts`
- AppShell sync role:
  - Hydrates remote + local on auth-ready, merges, and persists into active local namespace.
  - Mirrors local save/rename/delete events to backend as best-effort background sync.
  - Logged-out mode skips remote calls completely.

Unified write contract (current truth):
- AppShell is the write owner for saved interface mutations.
- Commit surfaces in `src/screens/AppShell.tsx`:
  - `commitUpsertInterface`
  - `commitPatchLayoutByDocId`
  - `commitRenameInterface`
  - `commitDeleteInterface`
  - `commitHydrateMerge`
- Graph and node-binding emit callbacks to AppShell; they do not directly mutate saved interface storage anymore.

Remote failure behavior (current truth):
- Remote sync uses a persistent per-identity outbox in AppShell.
- Local state + localStorage are UX truth; remote is mirror-only.
- Outbox localStorage namespace:
  - `arnvoid_saved_interfaces_v1_remote_outbox_<identityKey>`
- Retry policy:
  - retryable: network/timeout, 5xx, 429
  - 401: pause then retry window; local remains unaffected
  - 413/non-retryable: drop outbox item; local remains unaffected
  - `payload_missing`: non-retryable (prevents infinite retry loop)
- Outbox is namespaced by identity key to prevent cross-account bleed.
- Restore-active phase blocks remote drain.

Ordering contract (critical):
- Ordering truth is `record.updatedAt` inside saved payload (`payload_json`), not DB row `updated_at`.
- Reason: backend upsert sets row `updated_at=now()` and would reorder on rename if used for sort.
- Frontend API fields for row timestamps are DB-scoped (`dbCreatedAt`, `dbUpdatedAt`) and must not drive list ordering.

Input safety contract:
- Sidebar root, row menu, row menu items, and delete confirm modal all stop pointer and wheel propagation.
- Search overlay, profile modal, logout confirm modal, and delete confirm modal follow the same hard-shield pattern.
- Modal/backdrop interactions must never leak to canvas input handlers.

Restore purity contract:
- Restore path is read-only.
- Restore applies saved `parsedDocument`, `topology`, `layout`, `camera`, and `analysisMeta`.
- Restore must not enqueue save/upsert/delete/layout-patch side effects.
- Structural restore-active guards exist in graph shell and AppShell commit layer.

Critical gotchas (must not regress):
- Do not reorder sessions on rename. Rename must not bump payload `updatedAt`.
- Do not use DB row timestamps (`created_at`, `updated_at`) for UI ordering.
- Do not write during restore path. Restore must remain read-only.

## 3. Physics Architecture And Contract
The graph is driven by a **Hybrid Solver** (`src/physics/`) prioritizing "Visual Dignity" over pure simulation accuracy.

### Policy Layer (Physics Mapping)
- Mapping of directed knowledge link types to undirected physics spring params is centralized in `src/graph/physicsMappingPolicy/`.
- The seam is `deriveSpringEdges(topology, config, policy)` in `src/graph/springDerivation.ts`.
- Policy is deterministic: same topology + same policy -> identical spring set and params.

### Edge Length Knobs (Current Gap)
There is a known gap between the policy rest length and XPBD constraint rest length.
What you see on screen is driven by XPBD constraints, which currently use the
current distance at spawn, not `linkRestLength`.

Knobs that actually change visible edge length right now:
- `targetSpacing` in `src/physics/config.ts` (used by mapping policy to set spring rest length)
- Per-edge rest length policy in `src/graph/physicsMappingPolicy/defaultPolicy.ts`

Knobs that do NOT change visible edge length in XPBD:
- `linkRestLength` in `src/physics/config.ts` (used in edge relaxation/force pass, not XPBD rest length)

Unification fix (future):
- In `src/physics/engine/engineTickXPBD.ts`, use per-link rest length
  (from `link.length` or derived spring restLen) instead of spawn distance
  when building XPBD constraints.

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
Post-Fixes #01-#22, the system guarantees:

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

### C. Paper Analyzer Output (Directed Map)
*   **Prompt + Schema**: `src/ai/paperAnalyzer.ts` now requires both points and directed links.
*   **Single Prompt Truth Source**: Analyzer prompt instructions are centralized in `src/server/src/llm/analyze/prompt.ts` and reused by backend analyze plus frontend DEV direct analyze.
*   **Output Fields**:
    *   `main_points`: indexed points (0..N-1), each with title and explanation.
    *   `links`: directed edges using `from_index` and `to_index`.
*   **Wiring**: `src/document/nodeBinding.ts` maps indices to live dot IDs, calls `setTopology(...)`, then rebuilds physics links from derived springs.

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

### C. Pass Ordering (Edges -> Dots)
1.  **Edges Pass 1**: draw all non-neighbor edges at `dimOpacity`.
2.  **Edges Pass 2**: draw neighbor edges in `neighborEdgeColor` using `dimEnergy` as alpha.
3.  **Dots Pass**: apply `nodeOpacity` per dot (neighbors + hovered remain full opacity).
4.  **Hovered Brighten**: hovered dot gets a brightness boost (~30%) independent of dimming.


# BACKEND (Arnvoid)

## Purpose
Central operating notes for backend/frontend behavior, integration seams, and live environment assumptions.

## LLM Provider Policy
- Provider routing is policy-driven (daily cohort + per-user cap + global pool).
- See test verification report: `docs/report_2026_02_06_provider_step4_test_results.md`.
- Real token counting uses provider usage when available, tokenizer fallback otherwise.
- Free pool decrements are idempotent via `openai_free_pool_ledger`.

## LLM Endpoints
Backend LLM endpoints:
- `POST /api/llm/paper-analyze`
- `POST /api/llm/chat`
- `POST /api/llm/prefill`

## LLM Audit
- Per-request audit records are stored in `llm_request_audit`.
- Audit includes provider/model, token counts, rupiah cost, and free pool metadata.

## Payments (GoPay QRIS)
Backend:
- `POST /api/payments/gopayqris/create`
- `GET /api/payments/:orderId/status`
- `POST /api/payments/webhook`

Frontend:
- `src/components/PaymentGopayPanel.tsx`
- `src/components/PromptCard.tsx`

## Auth
- Cookie name: `arnvoid_session`
- `/me` is the only source of truth for user state.
- All backend calls must include `credentials: "include"`.
- Frontend route base is `VITE_API_BASE_URL`:
  - auth calls are `${VITE_API_BASE_URL}/auth/google`, `${VITE_API_BASE_URL}/auth/logout`, and `${VITE_API_BASE_URL}/me`.
  - `/api/*` pathing is only true when `VITE_API_BASE_URL=/api` (for example behind Vercel rewrite).
- Backend runtime route ownership:
  - route logic lives in `src/server/src/serverMonolith.ts`.
  - `src/server/src/index.ts` is a thin entry that imports `serverMonolith`.
- `/me` payload contract:
  - returns `sub`, `email`, `name`, `picture`, `displayName`, `username` for signed-in state.
  - `picture` is the Google profile photo URL used by Sidebar and profile UI.
  - does not currently return DB numeric `id` in the `/me` response body.
  - frontend identity logic must support `sub` fallback for namespacing and sync isolation.
- Profile update contract:
  - endpoint: `POST /api/profile/update` (`requireAuth`) in `src/server/src/serverMonolith.ts`.
  - request fields: `displayName`, `username` with trim/max-length/regex validation.
  - schema columns: `users.display_name`, `users.username` from migration `src/server/migrations/1770383500000_add_user_profile_fields.js`.
  - UI owner: AppShell profile modal in `src/screens/AppShell.tsx` (opened from Sidebar avatar menu).
  - save path uses `updateProfile(...)`, applies returned user fields locally, then runs `/me` refresh as reconciliation.
- Logout UI contract:
  - logout action is accessed from Sidebar avatar popup menu, not EnterPrompt.
  - logout confirmation is AppShell-owned centered modal that runs the same auth logout path.

## Backend VPN Reminder
- Before running backend commands in `src/server` (for example `npm run dev`, `npm run check:auth-schema`, DB scripts), turn VPN OFF.
- VPN can block or slow Cloud SQL connector setup and cause startup timeout errors.

## Fonts
- Canonical entrypoint: `src/styles/fonts.css` imported once in `src/main.tsx`.
- Quicksand is registered as `woff2` multi-weight faces (400/500/600/700).
- Use CSS vars for global usage:
  - `--font-ui`
  - `--font-title`

## Scrollbar Theme (Frontend)
- Arnvoid uses themed scrollbars. Do not use browser-default scrollbar styling on product UI surfaces.
- Base class: `.arnvoid-scroll` in `src/index.css`.
- Search Interfaces overlay class: `.search-interfaces-scroll` in `src/index.css`.
- Required Search overlay palette:
  - track background: `#0D1118`
  - thumb/buttons: dark navy
- New scrollable UI surfaces should adopt `.arnvoid-scroll` or a scoped variant derived from it.

## Money UX (Frontend)
- Rupiah balance anchor (`BalanceBadge`) is always visible on `graph`.
- On `prompt`, balance anchor visibility is controlled by `SHOW_ENTERPROMPT_BALANCE_BADGE` in `src/config/onboardingUiFlags.ts`.
- Shortage warning gate for paid actions with topup CTA.
- Money notices for payment/balance/deduction outcomes.
- Offline or backend-unreachable network failures do not emit balance/payment/chat money notices.
- Reports: docs/report_2026_02_07_moneyux_final.md and step reports.
