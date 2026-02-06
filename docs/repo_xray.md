# Repository X-Ray: Arnvoid

Generated for External AI Context Loading
Target: Deep Codebase Understanding without Repo Access
Date: 2026-02-06

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
|   |-- auth/                  # Auth state + session UI
|   |   |-- AuthProvider.tsx   # React Context auth state
|   |   `-- SessionExpiryBanner.tsx # Session expiry banner
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
12. src/auth/AuthProvider.tsx - Auth context + /me bootstrap
13. src/auth/SessionExpiryBanner.tsx - Session expiry UI
14. src/api.ts - Backend fetch helper (credentials include)
15. src/server/src/index.ts - Auth routes, payments, LLM endpoints
16. src/server/src/llm/llmClient.ts - Server LLM client (Responses API)
17. src/server/src/db.ts - Cloud SQL connector + pool
18. src/server/src/llm/usage/usageTracker.ts - LLM usage tracker and tokenizer fallback
19. src/server/src/llm/audit/llmAudit.ts - LLM audit persistence
20. src/components/PaymentGopayPanel.tsx - QRIS payment UI panel
21. src/components/PromptCard.tsx - EnterPrompt main card (renders payment panel)

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

## 7. Auth Flow Map (Google Login + Sessions)

Key files:
- `src/auth/AuthProvider.tsx` (single source of truth for auth state)
- `src/auth/SessionExpiryBanner.tsx` (expiry UI)
- `src/components/GoogleLoginButton.tsx` (Google login entry)
- `src/api.ts` (GET /me with `credentials: "include"`)
- `src/server/src/index.ts` (auth routes, cookie, sessions)
- `src/server/src/db.ts` (Postgres connection)

Follow the auth flow:
1. User clicks login button -> Google returns `idToken`.
2. Frontend sends `POST /auth/google` with `idToken`.
3. Backend verifies token, inserts session row, sets `arnvoid_session` cookie.
4. Frontend calls `GET /me`, updates React Context user.
5. UI reads user state from `AuthProvider` and renders signed-in status.
6. Logout calls `POST /auth/logout`, clears session + cookie, user becomes null.

Note:
- `src/auth/useAuth.ts` was replaced by `AuthProvider.tsx`.

## 8. Payments (GoPay QRIS)
Frontend:
- `src/components/PaymentGopayPanel.tsx` for QRIS UI and polling.
- `src/components/PromptCard.tsx` renders the payment panel.
- `src/api.ts` includes `createPaymentGopayQris` and `getPaymentStatus` helpers.

Backend:
- `POST /api/payments/gopayqris/create`
- `GET /api/payments/:orderId/status`
- `POST /api/payments/webhook`

## 9. LLM Endpoints (Server-Side)
Backend:
- `POST /api/llm/paper-analyze`
- `POST /api/llm/chat`
- `POST /api/llm/prefill`

Client call sites:
- `src/ai/paperAnalyzer.ts`
- `src/fullchat/fullChatAi.ts`
- `src/fullchat/prefillSuggestion.ts`

## 10. LLM Usage + Audit
Backend:
- `src/server/src/llm/usage/usageTracker.ts` (provider usage + tokenizer fallback)
- `src/server/src/llm/usage/providerUsage.ts`
- `src/server/src/llm/usage/tokenCounter.ts` (@dqbd/tiktoken)
- `src/server/src/llm/audit/llmAudit.ts` (request audit upsert)
- `src/server/migrations/1770382500000_add_llm_request_audit.js`
- `src/server/migrations/1770382000000_add_openai_free_pool_ledger.js`

## 11. Money UX (Frontend)

Frontend components and stores:
- src/components/BalanceBadge.tsx
- src/components/ShortageWarning.tsx
- src/components/MoneyNoticeStack.tsx
- src/store/balanceStore.ts
- src/money/shortageStore.ts
- src/money/ensureSufficientBalance.ts
- src/money/estimateCost.ts
- src/money/topupEvents.ts
- src/money/moneyNotices.ts

Reports:
- docs/report_2026_02_07_moneyux_final.md
- docs/report_2026_02_07_moneyux_step1_balance_anchor.md
- docs/report_2026_02_07_moneyux_step4_shortage_warning.md
- docs/report_2026_02_07_moneyux_step7_failure_states.md
