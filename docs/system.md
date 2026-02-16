# Arnvoid System Documentation

## 1. Introduction
**Arnvoid** is a conversational graph interface designed for deep reasoning over complex knowledgebases. It acts as a "thinking partner" that lives inside the user's graph, providing context-aware synthesis and exploration.

The core flow is the **Paper Essence Pipeline**:
`Document (PDF/MD/TXT) -> AI Paper Analyzer -> Key Dots + Directed Links + Node Knowledge -> Interactive Graph -> Contextual Chat`.

## 1.1 ASCII Only
Use pure ASCII characters in code, comments, logs, and documentation. Avoid Unicode arrows, ellipses, and typographic dashes to prevent mojibake.

## 1.2 Worktree Collaboration Policy
- This repo may be edited by multiple agents at the same time.
- Unrelated modified or untracked files are expected and are not blockers.
- Agents should continue task execution without pausing only because unrelated tree changes appear.
- Scope edits to task-owned files and do not revert or mutate unrelated changes.

## 2. UI Surface Map & Ownership

The application layers, ordered by z-index (lowest to highest):

0.  **Onboarding Shell (Pre-Graph Startup Flow)**
    *   Active only on onboarding-class screens (`welcome1`, `welcome2`, `prompt`) in `src/screens/AppShell.tsx`.
    *   Flow state machine: `welcome1 -> welcome2 -> prompt -> graph_loading -> graph`.
    *   Transition control seams:
        *   canonical timing and route policy: `src/screens/appshell/transitions/transitionContract.ts`
        *   phase machine (idle, arming, fading): `src/screens/appshell/transitions/useOnboardingTransition.ts`
        *   layer host and input shield: `src/screens/appshell/transitions/OnboardingLayerHost.tsx`
    *   Animated route matrix:
        *   `welcome1 <-> welcome2`
        *   `welcome2 <-> prompt`
        *   any transition touching graph-class screens (`graph_loading` or `graph`) is non-animated by policy.
    *   Env gate: `ONBOARDING_ENABLED` (`src/config/env.ts`):
        *   `false` or not set: app starts directly in `graph`.
        *   `true` or `1`: app starts in `welcome1`.
    *   Dev start override: `VITE_ONBOARDING_START_SCREEN` (`src/config/env.ts`):
        *   Canonical values: `welcome1`, `welcome2`, `prompt`, `graph_loading`, `graph`.
        *   Legacy aliases: `screen1`, `screen2`, `screen3`, `screen4`.
        *   Applies in DEV only. Invalid values fall back to `welcome1` and emit a single DEV warning.
    *   Persistence is currently disabled (`PERSIST_SCREEN = false`), so refresh resets onboarding to `welcome1` when onboarding is enabled.
    *   Graph isolation contract: `GraphPhysicsPlayground` (thin wrapper) is lazy-loaded and mounted only for graph-class screens (`graph_loading` and `graph`), then delegates to `GraphPhysicsPlaygroundContainer` in `src/playground/modules/GraphPhysicsPlaygroundContainer.tsx`. This keeps physics/rendering inactive during onboarding screens.
    *   Money overlays mount on `prompt` and graph-class screens:
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
    *   Exposes `Back` (to `welcome1`) and `Skip` (to `graph_loading`) actions.
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
    *   `LoginOverlay` is currently enabled in EnterPrompt (`LOGIN_OVERLAY_ENABLED = true`).
    *   `LoginOverlay` blocks pointer/wheel interaction and locks page scroll while open.
    *   Continue button in LoginOverlay is a non-functional formal control (no click handler). Auth flow proceeds via session state update after sign-in.
    *   Login debug/error text is hidden by default in dev and visible by default in prod. Dev override: `VITE_SHOW_LOGIN_DEBUG_ERRORS=1`.
*   **Role in flow**:
    *   `onEnter` moves to `graph_loading` (authenticated continue path).
    *   `onSkip` can also move to `graph_loading` (bypass path).
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

AppShell architecture note (2026-02-14):
- `src/screens/AppShell.tsx` is orchestration-only (`432` lines).
- Domain logic lives under `src/screens/appshell/*` (screen flow, transitions, overlays, saved interfaces, render mapping, sidebar wiring).
- See `docs/report_2026_02_14_appshell_modularization.md` for seam-by-seam ownership and commit history.

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
  - when selected from prompt screen, AppShell transitions to `graph_loading`; restore runs on warm-mounted graph runtime and graph reveal still requires Confirm.
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
  - when Sidebar is frozen during `graph_loading`, row menu actions are non-actionable.

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
  - parser seam in `src/server/src/server/jsonParsers.ts` with saved-interfaces-specific 413 mapping.
  - contract guard: `npm run test:jsonparsers-contracts` in `src/server`.
  - user-facing 413 error body for saved-interfaces stays:
    - `{ ok: false, error: "saved interface payload too large" }`
- AppShell orchestration role:
  - Hydrates remote + local on auth-ready, merges, and persists into active local namespace.
  - Mirrors local save/rename/delete events to backend as best-effort background sync.
  - Logged-out mode skips remote calls completely.

Unified write contract (current truth):
- AppShell is the write owner for saved interface mutations.
- Commit surfaces live in `src/screens/appshell/savedInterfaces/savedInterfacesCommits.ts` and are wired from AppShell:
  - `commitUpsertInterface`
  - `commitPatchLayoutByDocId`
  - `commitRenameInterface`
  - `commitDeleteInterface`
  - `commitHydrateMerge`
- Graph and node-binding emit callbacks to AppShell; they do not directly mutate saved interface storage anymore.

Remote failure behavior (current truth):
- Remote sync uses a persistent per-identity outbox in `src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts` (wired by AppShell).
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

## 2.5 AppShell Seams (2026-02-14)

- AppShell orchestration entry: `src/screens/AppShell.tsx`
- screen policy: `src/screens/appshell/screenFlow/*`
- onboarding transitions: `src/screens/appshell/transitions/*`
  - transition contract and route policy: `src/screens/appshell/transitions/transitionContract.ts`
- overlays and modal rendering: `src/screens/appshell/overlays/*`
- saved interface commits and sync: `src/screens/appshell/savedInterfaces/*`
- screen render mapping: `src/screens/appshell/render/renderScreenContent.tsx`
- sidebar wiring: `src/screens/appshell/sidebar/*`
- full modularization report: `docs/report_2026_02_14_appshell_modularization.md`

## 2.6 Graph Screen Layout And Sidebar Modes (2026-02-15)

Current graph-screen layout contract:
- Graph screen is hosted by `GraphScreenShell` from `src/screens/appshell/render/GraphScreenShell.tsx`.
- `GraphScreenShell` uses a two-pane layout:
  - left pane: structural sidebar column (`graph-screen-sidebar-pane`)
  - right pane: graph pane (`graph-screen-graph-pane`) that hosts graph runtime
- Left pane width is driven by the same AppShell state used by product Sidebar:
  - state owner: `isSidebarExpanded` in `src/screens/AppShell.tsx`
  - collapsed width: `35px`
  - expanded width: `10vw` with min `200px`
  - shared tokens live in `src/screens/appshell/appShellStyles.ts`
- Graph runtime is container-relative:
  - playground root fills parent container (`width: 100%`, `height: 100%`)
  - viewport binding is owned by screen shell layout, not by playground root.

Sidebar modes (current behavior):
- Product Sidebar:
  - owner path: `SidebarLayer` -> `Sidebar`
  - state: `isSidebarExpanded` in AppShell
  - rendered as overlay on `prompt`, `graph_loading`, and `graph`
  - graph screen also reserves structural left column width that follows the same state.
- Non-graph screens:
  - continue using original overlay-only Sidebar pattern.
- Internal debug sidebar:
  - lives in `GraphPhysicsPlaygroundShell`
  - debug-only controls panel, gated by `enableDebugSidebar`
  - product graph path passes `enableDebugSidebar={false}`.

Layering and shielding guardrails:
- `GraphScreenShell` and pane wrappers must not introduce new z-index layers above overlays or modals.
- Overlay/modal/sidebar surfaces on top of graph must shield pointer and wheel so dot canvas never receives leaked input.

## 2.7 Graph Loading Gate (2026-02-15/16)

Purpose:
- `graph_loading` is a real screen state between `prompt` and `graph`.
- it owns loading UX and reveal gating; graph screen reveal requires explicit Confirm.

Flow and mount model:
- forward graph spine: `prompt -> graph_loading -> graph`.
- `graph_loading` and `graph` share one warm-mounted graph runtime subtree (no screen-key remount).
- runtime status is split and reported as:
  - loading signal: `aiActivity` only
  - error signal: `aiErrorMessage` (independent from loading)
- AppShell gate logic consumes the split status and does not treat error as loading.

Gate UI surface:
- full-viewport opaque surface (`#06060A`) mounted in graph-class render branch.
- center status text:
  - loading path: `Loading...`
  - done path: `Loading Complete`
- bottom-center Confirm control appears/enables only when gate reaches done.
- gate never auto-continues to graph; reveal happens only by Confirm action.

Gate state machine (high level):
- phases: `idle`, `arming`, `loading`, `stalled`, `error`, `done`, `confirmed`.
- entry intent snapshot: `analysis` | `restore` | `none`.
- done unlock:
  - real loading lifecycle (`isLoading` true then false), or
  - explicit no-work fallback only when entry intent is `none`.
- error policy:
  - for analysis/restore entry intent, runtime error moves gate to `error`.
  - gate confirm is disabled in `error`.
  - gate action is forced back to prompt (`force_back_prompt`).
- watchdog:
  - if loading never starts for analysis/restore intent, phase moves to `stalled` and escape remains available.
  - watchdog never overrides `error`, `done`, or `confirmed`.

Input, focus, and keyboard ownership:
- gate wrapper blocks pointer and wheel so canvas does not react under loading surface.
- gate root is focus anchor during `graph_loading`.
- key capture policy:
  - `Escape`: back to prompt
  - `Enter` / `Space`: confirm only when enabled
  - capture listeners stop propagation to prevent key leaks to canvas/sidebar
- fallback window capture listener enforces same behavior if focus escapes gate root.

Sidebar behavior during `graph_loading`:
- sidebar remains visible as eye-stability anchor.
- sidebar is frozen and dimmed (`alpha 0.5`), with inert + shield so pointer/wheel/focus do not leak.
- sidebar disabled rule is loading-only; runtime error state does not extend disabled state.
- temporary clamp policy:
  - if sidebar was expanded on entry to `graph_loading`, it is temporarily collapsed during loading.
  - on leave to `graph`, expanded state is restored to the pre-loading user state.

Legacy runtime loading surface:
- legacy `LoadingScreen` return path inside `GraphPhysicsPlaygroundShell` is suppressed for product graph-class path (`legacyLoadingScreenMode='disabled'` for `graph_loading` and `graph`).
- compatibility callback `onLoadingStateChange` remains available.
- runtime status callback now exposes `{ isLoading, aiErrorMessage }` for gate-grade handling.

Prompt error handoff:
- when gate forces back to prompt due analysis/restore error, AppShell stores a transient prompt error message.
- `EnterPrompt`/`PromptCard` render a dismissible inline error banner above the prompt input.
- banner clears on dismiss, new submit, or prompt skip.

DEV-only debug hooks:
- `?debugWarmMount=1`:
  - warm-mount logs (`[WarmMount] ... mountId=...`)
  - gate phase logs (`[GatePhase] ...`)
- optional DEV screen toggle hook:
  - `window.__arnvoid_setScreen('graph_loading' | 'graph')`
  - use only for local verification.

## 2.8 Graph Runtime Lease Guard (2026-02-15)

Purpose:
- enforce single active graph runtime ownership across prompt preview and graph screen paths.
- prevent double-runtime cross-talk on global channels during rapid prompt <-> graph transitions.

Ownership model:
- owner `prompt-preview`: `src/components/SampleGraphPreview.tsx`
- owner `graph-screen`: graph-class runtime mount in `src/screens/appshell/render/renderScreenContent.tsx`

Lease primitive:
- `src/runtime/graphRuntimeLease.ts`
- acquire API: `acquireGraphRuntimeLease(owner, instanceId)`
- release API: `releaseGraphRuntimeLease(token)`
- read API: `getActiveGraphRuntimeLease()`
- debug snapshot: `getGraphRuntimeLeaseDebugSnapshot()`

Priority policy:
1. only one active lease at a time
2. graph-screen acquisition preempts prompt-preview if active
3. prompt-preview is denied while graph-screen lease is active
4. stale release tokens are ignored safely

Mount gate seam:
- `src/runtime/GraphRuntimeLeaseBoundary.tsx`
- preview uses deny-block behavior (runtime does not mount when denied)
- graph-screen path mounts through graph-screen lease boundary with preemptive priority

Dev instrumentation:
- event logs (dev only): acquire, deny, preempt, release, stale_release_ignored
- counters exposed through `getGraphRuntimeLeaseDebugSnapshot()`

Self-enforcing ownership additions (step4 bug fix):
- lease snapshot API:
  - `getGraphRuntimeLeaseSnapshot()`
  - returns `activeOwner`, `activeInstanceId`, `activeToken`, `epoch`
- subscription API:
  - `subscribeGraphRuntimeLease(listener)`
- token activity API:
  - `isGraphRuntimeLeaseTokenActive(token)`
- dev assertion helper:
  - `assertActiveLeaseOwner(owner, token?)`

Lease-loss unmount behavior:
1. `SampleGraphPreview` acquires token and subscribes to lease updates.
2. if token becomes inactive after preempt, preview immediately switches to paused state and unmounts graph runtime.
3. preview reacquire is event-driven and epoch-gated (no polling).
4. graph runtime boundary also watches token activity and can defensively reacquire.

Expected debug counters/logs:
- runtime lease counters:
  - `notifyCount`
  - `tokenInactiveChecks`
- preview counters:
  - `lostLeaseUnmountCount`
  - `reacquireAttemptCount`
  - `reacquireSuccessCount`

## 2.8 Graph Runtime Cleanup Hardening (2026-02-15)

Purpose:
- enforce balanced runtime cleanup across repeated prompt <-> graph mount cycles.
- prevent listener and frame-loop accumulation in shared graph runtime path.

Patched leak risks:
1. `graphRenderingLoop` canvas wheel listener now has explicit teardown:
   - add: `canvas.removeEventListener('wheel', handleWheel)`
2. `graphRenderingLoop` font listener now has explicit teardown:
   - add: `document.fonts.removeEventListener('loadingdone', handleFontLoad)`
3. `graphRenderingLoop` now guards late async callbacks and frame reschedule after unmount:
   - `disposed` guard in `handleFontLoad`
   - `disposed` guard before all `requestAnimationFrame(render)` re-schedules

Dev-only resource tracker:
- file: `src/runtime/resourceTracker.ts`
- tracked names are under `graph-runtime.*`
- API:
  - `trackResource(name)` -> idempotent release function
  - `getResourceTrackerSnapshot()`
  - `warnIfGraphRuntimeResourcesUnbalanced(source)`
- hardening (2026-02-16):
  - decrements can no longer drive counts below zero in DEV.
  - invalid decrement attempts are clamped to `0` and warn once per resource name with a short stack excerpt.
  - unbalance warnings are deduped once per source to reduce spam while preserving signal.

Unmount invariant seam points:
- `src/components/SampleGraphPreview.tsx` cleanup
- `src/runtime/GraphRuntimeLeaseBoundary.tsx` cleanup
- both call `warnIfGraphRuntimeResourcesUnbalanced(...)` in DEV to catch non-zero graph runtime counters.

Manual verification checklist:
1. Open prompt screen (preview mounts), then go to graph, then back to prompt several times.
2. In DEV logs, verify no repeated unbalanced `graph-runtime.*` warnings grow over cycles.
3. Confirm graph behavior remains unchanged (drag, hover, wheel, popup flow).
4. Confirm preview and graph transitions still obey lease ownership rules.

Manual verification checklist:
1. open prompt screen: preview acquires lease and renders graph.
2. navigate to graph-class screen: graph-screen preempts preview lease.
3. navigate back to prompt: preview reacquires lease cleanly.
4. rapid prompt <-> graph toggling: no simultaneous active owners.
5. expected dev warnings are limited to deny/preempt/stale release events only.
6. if preview and graph overlap briefly, preview shows paused state and does not keep runtime mounted.

## 2.8 Sample Preview Restore Hardening (2026-02-15)

Purpose:
- ensure EnterPrompt sample preview restore is fail-closed.
- preview runtime mounts only when sample payload passes strict structural and semantic validation.

Canonical preview pipeline:
1. dynamic sample import in `src/components/SampleGraphPreview.tsx`
2. strict dev export parse:
   - `src/lib/devExport/parseDevInterfaceExportStrict.ts`
3. adapter strict conversion:
   - `src/lib/devExport/devExportToSavedInterfaceRecord.ts`
   - no silent topology coercion by default
4. preview-only saved record parse wrapper:
   - `src/lib/devExport/parseSavedInterfaceRecordForPreview.ts`
5. semantic validation:
   - `src/lib/preview/validateSampleGraphSemantic.ts`
6. mount:
   - only if all stages return Result ok
   - then pass `pendingLoadInterface` into `GraphPhysicsPlayground`

Key hardening rules:
1. no silent empty-topology fallback in strict preview path.
2. empty topology is explicit failure in preview:
   - `SAMPLE_PREVIEW_REQUIRE_NONEMPTY_TOPOLOGY = true`
3. any validation failure shows explicit error UI and blocks runtime mount.
4. preview validation is isolated; global saved-interface parser behavior is unchanged.

How to swap sample safely:
1. replace `src/samples/sampleGraphPreview.export.json` content with new dev export.
2. keep `version`, `topology`, `layout.nodeWorld`, and `camera` present and sane.
3. open prompt preview and check for validation errors in-box.
4. if invalid in dev, one-time warning logs from:
   - `warnIfInvalidCurrentSamplePreviewExportOnce(...)`

Failure UI behavior:
1. title: `sample graph invalid`
2. first 3 errors shown with codes
3. `+N more` shown when additional errors exist
4. runtime does not mount on failure

Manual verification checklist:
1. valid sample: preview loads restored graph (not seed fallback).
2. break sample topology or camera: preview shows explicit coded errors.
3. invalid sample must not mount `GraphPhysicsPlayground`.
4. restore valid sample: preview returns to normal mount path.

## 2.10 Graph Viewport Contract (2026-02-15)

Purpose:
- define one viewport contract across graph-screen and boxed preview runtime paths.
- establish provider/hook plumbing before live resize and clamp migration work.

Contract module:
- `src/runtime/viewport/graphViewport.tsx`

Fields:
- `mode`: `app | boxed`
- `source`: `window | container | unknown`
- `width`: number
- `height`: number
- `dpr`: number
- `boundsRect`: `{ left, top, width, height } | null`

API:
- `defaultGraphViewport()`
- `GraphViewportProvider`
- `useGraphViewport()`
- `getGraphViewportDebugSnapshot(viewport)` (dev helper)

Current wiring (step 8 live, 2026-02-16):
1. graph-screen subtree:
   - provider owner: `src/screens/appshell/render/GraphScreenShell.tsx`
   - pane seam: `graph-screen-graph-pane` ref + live ResizeObserver hook via `src/runtime/viewport/useResizeObserverViewport.ts`
   - value behavior:
     - first paint fallback: `defaultGraphViewport()` (`source='window'` or `unknown` on SSR)
     - live app-mode pane rect updates (`source='container'`) on container resize
   - provider scope now includes both:
     - graph runtime boundary
     - `GraphLoadingGate`
2. preview runtime subtree:
   - `src/components/SampleGraphPreview.tsx`
   - wraps preview runtime with boxed-mode live viewport updates from the same ResizeObserver hook.
3. live measurement semantics:
   - ResizeObserver callbacks are coalesced to max 1 update per animation frame (rAF batching).
   - movement refresh is event-driven (window scroll/resize and visualViewport scroll/resize when available).
   - interaction refresh is event-driven on target pointer/wheel activity (passive listeners; pointermove is throttled).
   - mount stabilization runs as a bounded settle burst to catch early layout settling.
   - settle continuation is visibility-safe: hidden document stops settle continuation; visibility return triggers one refresh.
   - movement refresh uses bounded settle rAF bursts after origin changes (no permanent polling loop).
   - origin source is element viewport geometry from `getBoundingClientRect()` (`left/top`).
   - size source prefers ResizeObserver box size (`contentBoxSize` when present), then falls back to `contentRect.width/height`, then BCR size.
   - width/height are floored and clamped to `>=1`.
   - cleanup disconnects observer, removes movement listeners, and cancels pending rAF.
   - DEV tracker names:
     - `graph-runtime.viewport.resize-observer`
     - `graph-runtime.viewport.resize-raf`
     - `graph-runtime.viewport.position-listeners`
     - `graph-runtime.viewport.position-interaction-listeners`
     - `graph-runtime.viewport.position-settle-raf`
   - DEV counters include flush reason buckets:
     - `ro`, `scroll`, `vv`, `interaction`, `mount`, `visibility`

Step boundary:
- step 8 now provides live measurement with movement-aware origin refresh.
- boxed clamp/origin correctness in step 9 depends on step 8 origin truth from BCR plus movement refresh.

Manual verification checklist:
1. `npm run build` passes.
2. graph screen renders with no visible behavior change except accurate live viewport dims.
3. prompt preview still mounts and runs with live boxed viewport dims.
4. resizing graph pane updates viewport values (`app`, `source='container'`).
5. resizing preview container updates viewport values (`boxed`, `source='container'`).
6. no `graph-runtime.*` tracker unbalance warnings appear on mount/unmount cycles.

## 2.11 Boxed Viewport Consumption (Step 9, 2026-02-16)

Purpose:
- boxed preview screen-space math must consume `GraphViewport` contract values.
- eliminate boxed fallback dependence on window viewport bounds in tooltip/popup paths.

Changed subsystems:
1. Tooltip clamp and anchor local conversion:
   - `src/ui/tooltip/TooltipProvider.tsx`
2. Node popup position and clamp:
   - `src/popup/NodePopup.tsx`
3. Mini chatbar position and clamp:
   - `src/popup/MiniChatbar.tsx`
4. Chat shortage notification clamp:
   - `src/popup/ChatShortageNotif.tsx`
5. Shared boxed math helper:
   - `src/runtime/viewport/viewportMath.ts`

Rules:
- `viewport.mode === 'boxed'`:
  - use `viewport.width`, `viewport.height`, and `viewport.boundsRect` origin for local conversion and clamp.
  - boxed fallbacks prefer viewport/bounds dimensions and avoid relying on window-sized assumptions.
- app mode keeps prior behavior path (portal/app/window fallback semantics unchanged).

Dev invariants:
- boxed counters are tracked in `viewportMath`:
  - `boxedClampCalls`
  - `boxedPointerNormCalls`
  - `boxedTooltipClampCalls`
- warn-once fallback if `viewport.mode === 'boxed'` and `boundsRect` is missing:
  - `[ViewportMath] boxed viewport missing boundsRect; using origin 0,0 fallback`

Verification checklist:
1. EnterPrompt preview: tooltip stays inside preview box and clamps to box edges.
2. EnterPrompt preview: node popup + mini chat stay inside preview box.
3. EnterPrompt preview: pointer-driven popup placement remains aligned with dot movement.
4. Graph screen: tooltip/popup behavior remains unchanged vs previous app mode behavior.

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

## Backend Runtime Architecture
- Runtime shell entry: `src/server/src/serverMonolith.ts` (imports bootstrap and starts server).
- Runtime orchestration and order ownership: `src/server/src/server/bootstrap.ts`.
- Route modules: `src/server/src/routes/*.ts`:
  - `authRoutes.ts`, `profileRoutes.ts`, `savedInterfacesRoutes.ts`
  - `paymentsRoutes.ts`, `paymentsWebhookRoute.ts`
  - `llmAnalyzeRoute.ts`, `llmPrefillRoute.ts`, `llmChatRoute.ts`
  - `healthRoutes.ts`
- Route deps assembly: `src/server/src/server/depsBuilder.ts`.
- Core backend seams:
  - env: `src/server/src/server/envConfig.ts`
  - parsers: `src/server/src/server/jsonParsers.ts`
  - cors: `src/server/src/server/corsConfig.ts`
  - startup gates: `src/server/src/server/startupGates.ts`
  - cookies: `src/server/src/server/cookies.ts`
- Order invariants:
  - payments webhook route is registered before CORS middleware.
  - JSON parser chain is registered before route modules.
  - startup gates complete before `app.listen(...)`.

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
- Route files:
  - `src/server/src/routes/llmAnalyzeRoute.ts`
  - `src/server/src/routes/llmChatRoute.ts`
  - `src/server/src/routes/llmPrefillRoute.ts`
- Shared request flow seam:
  - `src/server/src/llm/requestFlow.ts`
  - contract guard: `npm run test:requestflow-contracts`
- Retry-After and API error header/order behavior are locked in the requestFlow seam and guard tests.

## LLM Audit
- Per-request audit records are stored in `llm_request_audit`.
- Audit includes provider/model, token counts, rupiah cost, and free pool metadata.

## Payments (GoPay QRIS)
Backend:
- `POST /api/payments/gopayqris/create`
- `GET /api/payments/:orderId/status`
- `POST /api/payments/webhook`
- Route files:
  - `src/server/src/routes/paymentsRoutes.ts`
  - `src/server/src/routes/paymentsWebhookRoute.ts`
- Midtrans helper seam:
  - `src/server/src/payments/midtransUtils.ts`

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
  - `src/server/src/index.ts` imports `src/server/src/serverMonolith.ts` (shell).
  - shell calls `startServer` from `src/server/src/server/bootstrap.ts`.
  - auth endpoints live in `src/server/src/routes/authRoutes.ts`.
  - auth helper seams:
    - `src/server/src/auth/googleToken.ts`
    - `src/server/src/auth/requireAuth.ts`
- `/me` payload contract:
  - returns `sub`, `email`, `name`, `picture`, `displayName`, `username` for signed-in state.
  - `picture` is the Google profile photo URL used by Sidebar and profile UI.
  - does not currently return DB numeric `id` in the `/me` response body.
  - frontend identity logic must support `sub` fallback for namespacing and sync isolation.
- Profile update contract:
  - endpoint: `POST /api/profile/update` (`requireAuth`) in `src/server/src/routes/profileRoutes.ts`.
  - request fields: `displayName`, `username` with trim/max-length/regex validation.
  - schema columns: `users.display_name`, `users.username` from migration `src/server/migrations/1770383500000_add_user_profile_fields.js`.
  - UI owner: AppShell profile modal in `src/screens/AppShell.tsx` (opened from Sidebar avatar menu).
  - save path uses `updateProfile(...)`, applies returned user fields locally, then runs `/me` refresh as reconciliation.
- Logout UI contract:
  - logout action is accessed from Sidebar avatar popup menu, not EnterPrompt.
- logout confirmation is AppShell-owned centered modal that runs the same auth logout path.

## Backend Contract Tests
- Run from `src/server`:
  - `npm run test:contracts`
- Coverage summary:
  - request flow mapping and API error/header behavior
  - json parser split + saved-interfaces 413 mapping
  - cors policy callback/preflight behavior
  - startup gates ordering/shape
  - route contracts: health, auth, profile, saved-interfaces, payments
  - deps builder shape
  - monolith shell/bootstrap order markers (`npm run test:servermonolith-shell`)

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

## EnterPrompt Sample Graph Preview Mount (2026-02-15)
- Mount seam:
  - `src/components/PromptCard.tsx` keeps the existing preview wrapper `GRAPH_PREVIEW_PLACEHOLDER_STYLE`.
  - Inner placeholder label has been replaced by `<SampleGraphPreview />`.
- Preview component:
  - `src/components/SampleGraphPreview.tsx`
  - mounts `GraphPhysicsPlayground` (same runtime path as graph screen)
  - root marker: `data-arnvoid-graph-preview-root="1"`
- Sample JSON restore pipeline (canonical):
  - sample source file: `src/samples/sampleGraphPreview.export.json`
  - dev export type + guard: `src/lib/devExport/devExportTypes.ts`
  - adapter: `src/lib/devExport/devExportToSavedInterfaceRecord.ts`
  - canonical validation: `parseSavedInterfaceRecord(...)` in `src/store/savedInterfacesStore.ts`
  - runtime restore input: `pendingLoadInterface` in `GraphPhysicsPlayground`
  - flow: `DevInterfaceExportV1 -> adapter -> SavedInterfaceRecordV1 -> parseSavedInterfaceRecord -> pendingLoadInterface`
- How to swap sample map:
  1. Replace `src/samples/sampleGraphPreview.export.json` with another DevInterfaceExportV1 file.
  2. Keep top-level keys compatible (`version`, `exportedAt`, `title`, `parsedDocument`, `topology`, `layout`, `camera`, `analysisMeta`).
  3. Reload app; preview adapter + parser validate before runtime mount.
- Portal scope seam (preview-only container mode):
  - `src/components/portalScope/PortalScopeContext.tsx`
  - `SampleGraphPreview` creates internal portal root: `data-arnvoid-preview-portal-root="1"`
  - preview runtime is wrapped with `PortalScopeProvider mode="container"` + nested `TooltipProvider`
  - graph screen path remains default app mode (`document.body` portal root)
- Seam helper for future gating/scoping:
  - `src/components/sampleGraphPreviewSeams.ts`
  - exports preview root and preview portal root attr/value/selector helpers:
    - `isInsideSampleGraphPreviewRoot(...)`
    - `isInsideSampleGraphPreviewPortalRoot(...)`

Onboarding wheel guard allowlist (Step 6):
- guard hook: `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`
- guard remains active as a capture-phase window wheel listener during onboarding-active states.
- allowlist exception:
  - if wheel target is inside preview root OR preview portal root, guard returns early.
  - this allows embedded graph runtime wheel handler to own zoom/pan input.
- non-allowlist targets keep existing behavior (`preventDefault`) to block page scroll.

Current known risks not fixed yet:
1. Prompt overlays can mask preview:
   - drag/error/login overlays in `src/screens/EnterPrompt.tsx` are fixed and can block visibility/input.
2. Not in this step:
   - no render-loop cleanup fix
   - no topology singleton refactor
   - no performance retuning

Manual verification checklist for follow-up runs:
1. Prompt loads without crash and preview stays inside the 200px wrapper.
2. Placeholder label is gone; preview runtime surface is visible.
3. Preview labels/topology match the sample export (deterministic map, not seed-4 graph).
4. Click dot in preview: popup stays inside preview box.
5. Hover tooltip in preview: tooltip stays inside preview box.
6. No preview interaction renders fullscreen-ish UI outside preview box.
7. Graph screen behavior remains unchanged (app mode portals).
8. EnterPrompt overlays still behave as before (drag overlay, error overlay, login overlay).
9. Repeated prompt visit cycles do not cause obvious listener/input regressions.
10. EnterPrompt wheel guard allowlist:
    - wheel over preview zooms/pans graph.
    - wheel outside preview remains guarded (page does not scroll).
    - wheel over preview tooltip/popup/portal surfaces is treated as inside preview and remains allowed.
11. Graph screen wheel behavior remains unchanged.
