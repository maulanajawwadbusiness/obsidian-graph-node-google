# Repository X-Ray: Arnvoid

Generated for External AI Context Loading
Target: Deep Codebase Understanding without Repo Access
Date: 2026-02-15

Update Note: 2026-02-10
- Added local-first saved interface system and extensive Sidebar session UX hardening.

Update Note: 2026-02-11
- Added backend `saved_interfaces` schema and requireAuth CRUD API for account-backed memory.
- Added AppShell sync orchestration for local + remote saved interface merge/mirror.
- Added auth-aware localStorage namespace keys to prevent cross-account session bleed.
- Locked ordering contract to payload `updatedAt` (DB row timestamps are metadata only).
- Added unified AppShell write contract for saved interfaces (single writer seam).
- Added restore-read-only hardening (no save/sync side effects during restore).
- Added per-identity persistent remote outbox with retry/backoff for mirror resilience.
- Added remote outbox non-retryable guard for `payload_missing` to prevent infinite retries.

Update Note: 2026-02-12
- Added profile update endpoint + users profile columns integration (`display_name`, `username`).
- Sidebar avatar flow now owns profile open and logout trigger path (with AppShell confirm modal).
- Font system moved to Quicksand `woff2` multi-weight via `src/styles/fonts.css` and CSS vars.

Update Note: 2026-02-14
- Completed AppShell modularization runs 1-8.
- `src/screens/AppShell.tsx` is orchestration-only at 447 lines.
- Domain seams moved under `src/screens/appshell/*` (screenFlow, transitions, overlays, savedInterfaces, render, sidebar, helpers/styles).
- See `docs/report_2026_02_14_appshell_modularization.md`.

Update Note: 2026-02-15
- Completed backend refactor runs 0-14.
- `src/server/src/serverMonolith.ts` is now a shell that starts bootstrap.
- Orchestration and ordering live in `src/server/src/server/bootstrap.ts`.
- Route deps assembly lives in `src/server/src/server/depsBuilder.ts`.
- Backend routes are split into `src/server/src/routes/*` (health/auth/profile/saved-interfaces/payments/webhook/llm).
- Contract guards expanded and unified under `npm run test:contracts` in `src/server`.

## 0.1 AppShell Seams (2026-02-14)

- orchestrator: `src/screens/AppShell.tsx`
- screen flow: `src/screens/appshell/screenFlow/*`
- transitions: `src/screens/appshell/transitions/*`
- overlays and modals: `src/screens/appshell/overlays/*`
- saved interfaces: `src/screens/appshell/savedInterfaces/*`
- render mapping: `src/screens/appshell/render/renderScreenContent.tsx`
- sidebar wiring: `src/screens/appshell/sidebar/*`
- full details: `docs/report_2026_02_14_appshell_modularization.md`

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
|   |   |-- GraphPhysicsPlayground.tsx # Thin entry wrapper
|   |   |-- GraphPhysicsPlaygroundShell.tsx # Playground orchestration container
|   |   `-- modules/ # Playground seams (container + shared types)
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
6. src/playground/GraphPhysicsPlaygroundShell.tsx (legacy large container) - Main UI Controller
7. src/physics/engine/engine.ts (300+ lines) - Engine State Container
8. src/physics/engine/forcePass.ts (200 lines) - Forces
9. src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx (312 lines) - Doc Viewer
10. src/playground/rendering/renderLoopScheduler.ts (New) - Loop Logic
11. src/components/GoogleLoginButton.tsx - Google login entry
12. src/auth/AuthProvider.tsx - Auth context + /me bootstrap
13. src/auth/SessionExpiryBanner.tsx - Session expiry UI
14. src/api.ts - Backend fetch helper (credentials include)
15. src/server/src/routes/llmAnalyzeRoute.ts (561 lines) - Analyze endpoint orchestration
16. src/server/src/routes/paymentsRoutes.ts (227 lines) - Rupiah and payments create/status routes
17. src/server/src/routes/authRoutes.ts (218 lines) - Auth endpoints (/auth/google, /me, /auth/logout)
18. src/server/src/routes/savedInterfacesRoutes.ts (137 lines) - Saved interface CRUD routes
19. src/server/src/server/bootstrap.ts (142 lines) - Backend startup/order orchestration
20. src/server/src/server/depsBuilder.ts (120 lines) - Route deps assembly seam
21. src/components/PaymentGopayPanel.tsx - QRIS payment UI panel
22. src/components/PromptCard.tsx - EnterPrompt main card (input, attachments, submit control)

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
- `src/server/src/index.ts` (thin entry imports monolith shell)
- `src/server/src/serverMonolith.ts` (shell only, starts bootstrap)
- `src/server/src/server/bootstrap.ts` (runtime orchestration and order owner)
- `src/server/src/routes/authRoutes.ts` (auth route logic)
- `src/server/src/auth/requireAuth.ts` (session middleware)
- `src/server/src/server/cookies.ts` (cookie parse/set/clear helpers)
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

## 7.1 Saved Interfaces Sync Map (Current)

Primary files:
- `src/screens/AppShell.tsx` (orchestration and dependency wiring)
- `src/screens/appshell/savedInterfaces/savedInterfacesCommits.ts` (single-writer commit surfaces)
- `src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts` (hydrate + outbox retry engine)
- `src/store/savedInterfacesStore.ts` (local storage schema + namespace helpers)
- `src/playground/GraphPhysicsPlaygroundShell.tsx` (restore pipeline + callback emitters)
- `src/document/nodeBinding.ts` (analysis record creation, callback emission)
- `src/api.ts` (saved-interfaces API helpers)
- `src/server/src/routes/savedInterfacesRoutes.ts` (requireAuth CRUD API)
- `src/server/src/server/jsonParsers.ts` (saved-interfaces parser split + 413 mapping seam)
- `src/server/migrations/1770383000000_add_saved_interfaces.js` (DB table)

Current write ownership:
1. Graph analysis/layout and Sidebar actions emit into AppShell commit surfaces.
2. AppShell commits update in-memory list + persist local immediately.
3. Authenticated mode enqueues remote mirror operations into per-identity outbox.
4. Outbox drains asynchronously with retry policy.
5. Restore path is read-only and must not emit write commits.

Identity isolation:
- local saved key: guest vs `arnvoid_saved_interfaces_v1_user_<id>`
- outbox key: `arnvoid_saved_interfaces_v1_remote_outbox_<identityKey>`
- epoch + identity guards block stale async apply after identity switches.

Restore contract:
- restore is read-only and must not enqueue remote or local write-side effects.

Ordering contract:
- sidebar ordering uses payload `record.updatedAt` only.
- DB `updated_at` is metadata and must not drive UI ordering.

Payload and API contract:
- full payload is mirrored (`parsedDocument.text`, full meta/warnings, topology, layout/camera, analysisMeta)
- requireAuth backend routes:
  - `GET /api/saved-interfaces`
  - `POST /api/saved-interfaces/upsert`
  - `POST /api/saved-interfaces/delete`
- backend payload guard:
  - parser seam in `src/server/src/server/jsonParsers.ts`
  - 413 mapping guard: `npm run test:jsonparsers-contracts`
  - route validation guard: `npm run test:saved-interfaces-contracts`

Search overlay contract:
- centered AppShell overlay opened from Sidebar Search row
- in-memory search over AppShell saved list (no localStorage reads while typing)
- strict pointer/wheel shielding to prevent canvas input leaks

## 7.4 Important Files and Seams (Current)

Backend API seams:
- `src/server/src/serverMonolith.ts` (shell startup only)
- `src/server/src/server/bootstrap.ts` (order and startup orchestration)
- `src/server/src/server/depsBuilder.ts` (route deps assembly)
- `src/server/src/routes/authRoutes.ts`
- `src/server/src/routes/profileRoutes.ts`
- `src/server/src/routes/savedInterfacesRoutes.ts`
- `src/server/src/routes/paymentsRoutes.ts`
- `src/server/src/routes/paymentsWebhookRoute.ts`
- `src/server/src/routes/llmAnalyzeRoute.ts`
- `src/server/src/routes/llmPrefillRoute.ts`
- `src/server/src/routes/llmChatRoute.ts`

Backend migrations:
- `src/server/migrations/1770383000000_add_saved_interfaces.js`
- `src/server/migrations/1770383500000_add_user_profile_fields.js`

Frontend API helpers:
- `src/api.ts`
  - `listSavedInterfaces`
  - `upsertSavedInterface`
  - `deleteSavedInterface`
  - `updateProfile`

Frontend orchestration seams:
- `src/screens/AppShell.tsx`
  - orchestration-only shell: screen wiring, auth and saved-interface dependency injection
  - no monolithic domain internals
- `src/screens/appshell/screenFlow/*`
  - screen types, start policy, flow mapping, welcome1 font gate
- `src/screens/appshell/transitions/*`
  - onboarding transition machine, tokens, wheel guard, layer host
- `src/screens/appshell/overlays/*`
  - onboarding overlay/fullscreen chrome, modal state and modal layer, profile/logout controllers, search engine
- `src/screens/appshell/savedInterfaces/*`
  - commit surfaces + sync engine split
- `src/screens/appshell/render/renderScreenContent.tsx`
  - pure screen-to-jsx mapping
- `src/screens/appshell/sidebar/*`
  - sidebar wiring layer and interface item mapping
- `src/components/Sidebar.tsx`
  - saved session row list + ellipsis menu (rename/delete)
  - search overlay trigger wiring
  - avatar menu wiring (profile/logout request)
- `src/playground/GraphPhysicsPlaygroundShell.tsx`
  - restore path application
  - restore write guards (`restore_write_blocked`) to keep read-only restore

## 7.5 Gotchas (Do Not Regress)

- Do not reorder sessions on rename: rename must not bump payload `updatedAt`.
- Do not use DB row timestamps (`created_at`, `updated_at`) for ordering or merge decisions.
- Do not write during restore path: restore must stay read-only and block save/sync side effects.

## 7.6 Backend Order Invariants

- `registerPaymentsWebhookRoute(...)` must run before CORS middleware registration.
- `applyJsonParsers(...)` must run before route registration.
- startup gates must run before `app.listen(...)`.
- order guard script:
  - `npm run test:servermonolith-shell`

## 7.2 Saved Interfaces Call Graph (Step 7-9)

Write path (single writer):
1. Graph/nodeBinding/sidebar intent
2. AppShell-wired commit surface (`src/screens/appshell/savedInterfaces/savedInterfacesCommits.ts`)
3. immediate in-memory list update
4. immediate localStorage persist (active identity key)
5. optional outbox enqueue (authenticated only)
6. async outbox drain (retry/backoff, identity/epoch guarded)

Restore path (read-only):
1. Sidebar select -> `pendingLoadInterface`
2. Graph shell restore apply (`parsedDocument`, `topology`, `layout`, `camera`, `analysisMeta`)
3. restore-active guards block local commit and remote outbox drains

## 7.3 Saved Interfaces DB Reference

- migration file: `src/server/migrations/1770383000000_add_saved_interfaces.js`
- table: `public.saved_interfaces`
- key constraints:
  - FK `user_id -> users(id)` with `ON DELETE CASCADE`
  - unique `(user_id, client_interface_id)`
- indexes:
  - `(user_id, updated_at desc)`
  - `(user_id, title)`

## 8. Payments (GoPay QRIS)
Frontend:
- `src/components/PaymentGopayPanel.tsx` for QRIS UI and polling.
- `src/screens/EnterPrompt.tsx` hosts `PromptCard` and conditionally mounts `PaymentGopayPanel`.
- `src/api.ts` includes `createPaymentGopayQris` and `getPaymentStatus` helpers.

Backend:
- `POST /api/payments/gopayqris/create`
- `GET /api/payments/:orderId/status`
- `POST /api/payments/webhook`
- Route ownership:
  - `src/server/src/routes/paymentsRoutes.ts`
  - `src/server/src/routes/paymentsWebhookRoute.ts`

## 9. LLM Endpoints (Server-Side)
Backend:
- `POST /api/llm/paper-analyze`
- `POST /api/llm/chat`
- `POST /api/llm/prefill`
- Route ownership:
  - `src/server/src/routes/llmAnalyzeRoute.ts`
  - `src/server/src/routes/llmChatRoute.ts`
  - `src/server/src/routes/llmPrefillRoute.ts`

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

## 12. Onboarding Typing Stack (Welcome2)

Key files:
- `src/screens/welcome2ManifestoText.ts` (authored manifesto with `{p=###}` markers)
- `src/config/onboardingCadence.ts` (single source of cadence and semantic tuning)
- `src/screens/welcome2Timeline.ts` (deterministic timeline builder)
- `src/hooks/useTypedTimeline.ts` (rAF elapsed-time reveal hook)
- `src/components/TypingCursor.tsx` (shared needle cursor)
- `src/screens/Welcome2.tsx` (screen wiring + input guards)

Runtime contract:
1. Markers are parsed and stripped before render.
2. Timeline event times are deterministic for same text + same cadence.
3. Visibility is derived from elapsed time against event timestamps (binary search), not per-frame increments.
4. Cadence stack includes punctuation, newline, paragraph, marker, and semantic pauses.
5. Semantic layer currently uses distributed boundary pauses (word-end and sentence-landing transitions).

Debug entry points:
- `?debugType=1`: typing metrics summary logs.
- `?debugCadence=1`: cadence/semantic proof logs (resolved values, heavy-word matches, timing sample).

Known active workstream:
- Visual perception stability for typed text (phase/slip/jarring reports) is tracked in `docs/FUTURE_TODO.md` under `Welcome2 Typing Visual Stability (Chars Phase In/Out)`.

## 13. EnterPrompt Pending Analysis Flow (Text and File)

Current onboarding submit payload in `AppShell` supports:
- `kind: 'text'` with raw prompt text
- `kind: 'file'` with a `File` object from EnterPrompt attachment/drop

Consume path:
1. EnterPrompt submits text or attached file intent.
2. AppShell stores `pendingAnalysisPayload` and transitions to graph.
3. Graph consumes once (pre-clear), parses file via `documentContext.parseFile(file)` for file payloads, then runs analyzer mapping path.

## 14. Saved Interfaces + Sidebar Session Actions (2026-02-10)

Key files:
- `src/store/savedInterfacesStore.ts`
- `src/screens/AppShell.tsx`
- `src/components/Sidebar.tsx`
- `src/playground/GraphPhysicsPlayground.tsx` (thin wrapper)
- `src/playground/GraphPhysicsPlaygroundShell.tsx` (playground runtime orchestration)
- `src/document/nodeBinding.ts`

Current capabilities:
1. Local persistence of saved interfaces with full knowledge payload (`parsedDocument`, `topology`, `analysisMeta`).
2. Layout and camera persistence for restore parity.
3. Prompt-to-graph restore navigation when selecting saved sessions from prompt screen.
4. Inline rename with local persistence.
5. Delete via AppShell confirm modal with immediate list refresh.
6. Disabled-state hardening for row-menu actions while graph loading.
7. Backend account memory (Postgres `saved_interfaces`) with requireAuth list/upsert/delete API.
8. AppShell hydration merge (local + remote) and best-effort background mirror on save/rename/delete.
9. Auth namespace storage keying to isolate local cache per user and prevent account bleed.
10. Search overlay for instant saved-session lookup with strict input shielding.
11. Restore-purity and outbox resilience hardening (step 8 and step 9).

Interaction safety:
- Sidebar row menu and AppShell delete modal are shielded against pointer/wheel leakage to canvas.

Ordering note:
- Sidebar order is store-driven newest-first by `updatedAt`, then `createdAt`.
- Rename was hardened to avoid reorder by not mutating `updatedAt`.
- Remote ordering truth is payload `record.updatedAt` from `payload_json`.
- DB row timestamps (`created_at`, `updated_at`) are exposed as metadata and must not drive merge/sort.

Forensic report pointers:
- `docs/report_2026_02_10_google_memory_saved_interfaces_forensic_v2.md`
- `docs/report_2026_02_11_saved_interfaces_sync_brain_step5.md`
- `docs/report_2026_02_11_saved_interfaces_unified_write_contract_step7.md`
- `docs/report_2026_02_11_preserve_restore_pipeline_step8.md`
- `docs/report_2026_02_11_remote_failure_saved_interfaces_step9.md`
- `docs/report_2026_02_11_google_saved_sessions_steps_1_9_unified.md`
