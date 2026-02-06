# Arnvoid System Documentation

## 1. Introduction
**Arnvoid** is a conversational graph interface designed for deep reasoning over complex knowledgebases. It acts as a "thinking partner" that lives inside the user's obsidian graph, providing context-aware synthesis and exploration.

The core flow is the **Paper Essence Pipeline**:
`Document (PDF/MD/TXT) -> AI Paper Analyzer -> Key Dots + Directed Links + Node Knowledge -> Interactive Graph -> Contextual Chat`.

## 1.1 ASCII Only
Use pure ASCII characters in code, comments, logs, and documentation. Avoid Unicode arrows, ellipses, and typographic dashes to prevent mojibake.

## 1.2 Frontend Env Vars
API base must use a single canonical key:
- `VITE_API_BASE_URL` (do not use `VITE_API_BASE`).

## 1.3 Auth And Sessions
- Cookie auth uses `arnvoid_session` and must be sent with `credentials: "include"` on every backend request.
- Logout path is `POST /auth/logout`.
- Same-site deployments use `SameSite=Lax`; cross-site requires `SameSite=None` with `Secure=true`.
- Login entry point is `src/components/GoogleLoginButton.tsx` (POST `/auth/google`).

## 1.4 Backend Env Vars (Auth)
- `GOOGLE_CLIENT_ID`
- `ALLOWED_ORIGINS`
- `SESSION_COOKIE_SAMESITE`
- `SESSION_COOKIE_NAME`
- `OPENAI_API_KEY` (required for server LLM endpoints)

## 1.5 Vercel Proxy CORS
- If frontend is served from `https://beta.arnvoid.com` and calls `/api`, backend must allow origin `https://beta.arnvoid.com`.
- CORS allowlist is driven by `ALLOWED_ORIGINS` (comma-separated). If empty, default includes localhost and beta.

## 1.6 Auth: Google Login + Sessions
### Architecture (High Level)
- Frontend calls `/api/*` on `https://beta.arnvoid.com`.
- Vercel rewrite proxies `/api` to Cloud Run backend.
- Backend verifies Google ID token, writes session to Postgres, sets `arnvoid_session` cookie.
- Frontend bootstraps session via `GET /me` and stores user in React Context.

### Core Endpoints
- `POST /auth/google` (exchanges Google ID token for session)
- `GET /me` (returns `{ ok: true, user: User | null }`)
- `POST /auth/logout` (deletes session and clears cookie)

### Cookie Behavior
- Cookie name: `arnvoid_session`
- `httpOnly: true`
- `sameSite: "lax"` (same-site)
- `secure: true` in prod, `false` for localhost
- `path: "/"`

### Required Env Vars
Frontend:
- `VITE_API_BASE_URL` (for beta: `/api`)
- `VITE_GOOGLE_CLIENT_ID`

Backend:
- `GOOGLE_CLIENT_ID`
- `ALLOWED_ORIGINS` (comma-separated)
- `SESSION_COOKIE_SAMESITE` (optional override)
- `SESSION_COOKIE_NAME` (optional override)
- Postgres vars (see `src/server/src/db.ts`)

### Session Expiry UI
Files:
- `src/auth/AuthProvider.tsx` (single source of truth, `/me` bootstrap, expiry detection)
- `src/auth/SessionExpiryBanner.tsx` (UI banner)
Triggers:
- If user was previously logged in and `/me` later returns `user: null` or `401/403`, banner is shown.
- Success from `/me` with a user clears the expiry flag.

### Local Run
- Frontend: `npm run dev` (uses `VITE_API_BASE_URL`)
- Backend: `cd src/server` then `npm run start` (or `npm run dev` if available)
- Ensure `ALLOWED_ORIGINS` includes `http://localhost:5173` and `http://127.0.0.1:5173`.

### Prod (Beta Domain)
- Frontend: `https://beta.arnvoid.com`
- Backend: Cloud Run behind Vercel `/api` rewrite
- Ensure `ALLOWED_ORIGINS` includes `https://beta.arnvoid.com`

## 1.7 Database Operations (Laptop-First)
All routine DB work should run from the laptop. Do not use the Cloud Console for schema edits.

Key references:
- Workflow: `docs/db.md`
- Scripts: `src/server/scripts`
- Migrations: `src/server/migrations` (node-pg-migrate)

Quick notes:
- Start Cloud SQL Auth Proxy to `127.0.0.1:5432` using `INSTANCE_CONNECTION_NAME`.
- Run commands from `src/server` using npm scripts.
- Migrations use `npm run migrate` and expect `DATABASE_URL` (see `docs/db.md`).

## 1.8 Payments (GoPay QRIS)
Backend endpoints:
- `POST /api/payments/gopayqris/create` (auth required)
- `GET /api/payments/:orderId/status` (auth required)
- `POST /api/payments/webhook` (public)

Frontend wiring:
- UI entry lives in `src/components/PaymentGopayPanel.tsx` and is rendered inside `src/components/PromptCard.tsx`.
- API helpers live in `src/api.ts` and must use `credentials: "include"`.
- For QR display, use action name `qr-code` or `generate-qr-code`.
- For mobile, use action name `deeplink-redirect`.

## 1.9 LLM Endpoints (Server-Side)
Endpoints:
- `POST /api/llm/paper-analyze` (structured JSON schema)
- `POST /api/llm/chat` (streams raw text chunks)
- `POST /api/llm/prefill` (returns `{ ok, request_id, prompt }`)

Notes:
- All endpoints require cookie auth (`credentials: "include"`).
- Model defaults are enforced on the server via `AI_MODELS`.
- Streaming responses use `Content-Type: text/plain; charset=utf-8`.

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

6.  **Loading Screen (`LoadingScreen`)**
    *   Full-screen state during analysis start/finish and analysis failures.
    *   Replaces `AnalysisOverlay` in the graph UI.

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
Arnvoid uses server LLM endpoints for analyzer, chat, and prefill.

### A. The Core: Server LLM Endpoints
*   **Contract**: Frontend calls `/api/llm/*` endpoints for analyzer, chat, and prefill.
*   **Provider**: Server uses OpenAI Responses API via `src/server/src/llm/llmClient.ts`.
*   **Streaming**: Raw text chunks streamed to the client (no SSE framing).

### B. Current State
*   **Primary**: Server-side OpenAI Responses API (`v1/responses`).
*   **Behavior Doctrine**:
    *   **Streaming**: Raw deltas are forwarded to the frontend.
    *   **Abort Model**: Streaming closes on client disconnect or abort.

### C. Paper Analyzer Output (Directed Map)
*   **Prompt + Schema**: `src/ai/paperAnalyzer.ts` now requires both points and directed links.
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
