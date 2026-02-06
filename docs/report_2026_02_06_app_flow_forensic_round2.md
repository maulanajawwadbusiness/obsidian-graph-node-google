# App Flow Forensic Report Round 2
Date: 2026-02-06
Scope: keep-alive plan, unmount plan, overlay mechanics, API base reality, debug inventory

## 1) Keep Graph Alive Plan (No Remount)

### Engine creation boundary and re-init triggers
- Engine is created in `src/playground/GraphPhysicsPlayground.tsx` inside `GraphPhysicsPlaygroundInternal`.
  - Lines 48-53: `engineRef` is initialized once per component mount (`if (!engineRef.current) engineRef.current = new PhysicsEngine();`).
  - Re-init happens only on mount/unmount. No dependency-driven re-init.
- Render loop starts in `src/playground/useGraphRendering.ts` via `startGraphRenderLoop(...)` inside a `useEffect`.
  - Cleanup cancels rAF on unmount only.
  - There is no pause flag or external control to stop the loop while mounted.

### Keep-alive approach (screen controller that hides graph)
- Placement: create a top-level screen controller above `GraphPhysicsPlayground` (in `src/main.tsx` or a new root component) and render graph always, but visually hidden when not on graph screen.
- Suggested structure (conceptual):
  - `ScreenController` renders welcome1/welcome2/prompt and also renders `GraphPhysicsPlayground` in a sibling layer.
  - When current screen is not graph, apply a wrapper style to the graph container: `visibility: hidden` + `pointerEvents: none` + `position: fixed` + `inset: 0`.
    - Avoid `display: none` if you want to preserve layout sizes; with `display: none`, canvas rect becomes 0 and loop still runs.

### Disabling input when graph is hidden
- Pointer input to graph is driven by handlers on the main container in `GraphPhysicsPlaygroundInternal`.
- Wheel input is attached directly to the canvas in `startGraphRenderLoop` (`canvas.addEventListener('wheel', ...)`).
- Keyboard input is a window listener in `GraphPhysicsPlaygroundInternal` (`window.addEventListener('keydown', ..., capture: true)` at lines ~411-437).
- To fully block graph input when hidden, you must add a screen-visible gate inside these handlers (not present today).
  - Without changes, keyboard capture will still fire even if graph is visually hidden.
  - Pointer and wheel can be blocked by `pointerEvents: none` on the graph container or an overlay above it.

### Can the render loop be paused without unmount?
- No built-in pause. `startGraphRenderLoop` schedules rAF every frame and only stops on unmount (cleanup).
- The loop short-circuits if canvas rect is 0, but still schedules new rAF.
- If we need true pause, code changes are required (e.g., a `paused` flag to skip scheduling or a public stop/start API).

### Owners of input, rAF, engine init
- Pointerdown/move/up and capture: `src/playground/GraphPhysicsPlayground.tsx` (main container handlers).
- Wheel: `src/playground/rendering/graphRenderingLoop.ts` (`canvas.addEventListener('wheel', ...)`).
- Keydown: `src/playground/GraphPhysicsPlayground.tsx` (`window.addEventListener('keydown', ..., capture: true)`).
- rAF loop: `src/playground/rendering/graphRenderingLoop.ts` in `startGraphRenderLoop`.
- Engine init: `src/playground/GraphPhysicsPlayground.tsx` (`new PhysicsEngine()` in `GraphPhysicsPlaygroundInternal`).

## 2) Unmount Graph Plan (Remount Allowed)

### What state is lost on unmount
- Physics engine state: full graph layout, velocity, drag state, topology wiring.
  - Stored in `engineRef` within `GraphPhysicsPlaygroundInternal`.
- Document state: `DocumentProvider` is mounted inside `GraphPhysicsPlayground`, so it resets on unmount.
  - Active document, preview open state, AI activity, inferred title, and the worker instance are lost.
- Popup state: `PopupProvider` is also inside `GraphPhysicsPlayground`.
  - Selected node, popup geometry, mini chat messages all reset.
- Full chat state: `FullChatProvider` is inside `GraphPhysicsPlayground`.
  - Messages, streaming state, prefill status reset.
- Local UI state inside `GraphPhysicsPlaygroundInternal`:
  - Config, theme, sidebar/debug toggles, spawn seed, metrics, and drag scenario toggles reset.

### What state survives unmount
- Auth state: `AuthProvider` is mounted in `src/main.tsx`, so session state survives.
- Google OAuth provider: `GoogleOAuthProvider` is above all screens and survives.

## 3) Overlay Mechanics + Pointer Capture Hazards

### Overlay stacking (where rendered)
- Google login: rendered inside `GraphPhysicsPlaygroundInternal`, absolute top-right with `zIndex: 1000`.
- Session expiry banner: rendered inside graph container with `zIndex: 1001`.
- Analysis overlay: `src/components/AnalysisOverlay.tsx` with `zIndex: 2000`, blocks input.
- Popup overlay portal: `src/popup/PopupOverlayContainer.tsx` uses `position: fixed` + `zIndex: 1000`.
  - Backdrop at `zIndex: 1000`, popup at `zIndex: 1001`, mini chatbar at `zIndex: 1002`.
- Full chat panel: `src/fullchat/FullChatbarStyles.ts` uses `zIndex: 500`.
- Full chat toggle: `zIndex: 100`.
- Map title and brand label: `zIndex: 100` with `pointerEvents: none`.
- AI activity glyph: `zIndex: 9999` and `pointerEvents: none`.
- Debug overlay: `zIndex: 999999`.

### Pointer ownership rules (current behavior)
- Graph container captures pointer on `pointerdown` and owns pointer capture.
- Many overlay elements stop propagation on pointerdown to prevent capture:
  - Full chat panel: `onPointerDownCapture`, `onPointerMoveCapture`, `onPointerUpCapture`, `onWheelCapture` stop propagation.
  - Session expiry banner: `onPointerDown` stops propagation.
  - Google login container: parent `div` uses `onPointerDown` stopPropagation.
  - Debug overlay buttons and canvas overlay buttons stop propagation.
- AnalysisOverlay blocks interaction by `pointerEvents: all` and explicit stop handlers for mouse, wheel, touch.
- Popup overlay uses `pointerEvents: none` on container, and `pointerEvents: auto` on popup and chatbar.

### Z-index conventions
- 100 to 500: general overlays and panels (title/brand, chat toggle, full chat panel).
- 1000+ : popup system and auth overlays.
- 2000: analysis overlay hard-block.
- 9999+: AI activity glyph and debug overlay (debug overlay is 999999).

## 4) Environment + API Base Reality Check

### Vercel rewrite
- `vercel.json` rewrites `/api/*` to Cloud Run:
  - `https://arnvoid-api-242743978070.asia-southeast2.run.app/$1`

### Frontend API base (current)
- `src/api.ts` uses `import.meta.env.VITE_API_BASE_URL`.
- `src/auth/AuthProvider.tsx` and `src/components/GoogleLoginButton.tsx` use the same env var for auth endpoints.
- Environment values found:
  - `.env.local` sets `VITE_API_BASE_URL=/api`.
  - `.env.production` sets `VITE_API_BASE_URL=/api`.
- Vite dev server has no proxy configuration in `vite.config.ts`.
  - In dev, `/api` will hit the Vite dev server unless you provide a separate proxy or change `VITE_API_BASE_URL` to a full backend URL.

### Hardcoded URLs
- No frontend code uses the Cloud Run URL directly (only `vercel.json`).
- OpenAI client uses `https://api.openai.com/v1` (not the app backend).

### Credentials include
- `apiGet` uses `credentials: 'include'`.
- `/auth/google` and `/auth/logout` fetch calls use `credentials: 'include'`.

### Backend allowed origins
- `src/server/src/index.ts` reads `ALLOWED_ORIGINS` env var and falls back to:
  - `https://beta.arnvoid.com` and local dev origins.
- CORS uses `credentials: true` and blocks any origin not in the allowlist.

## 5) Debug / Log Inventory (Actionable)

Notes:
- This is an inventory only. No changes proposed here.
- Categorization uses: Must remain (core diagnostics), Should be DEV-gated, Safe to delete (pure dev UI).

### Table: file -> logs -> category

- `src/main.tsx#L14`: `[auth] VITE_GOOGLE_CLIENT_ID ...` -> Should be DEV-gated
- `src/api.ts#L30`: `[apiGet] GET ...` -> Should be DEV-gated
- `src/playground/GraphPhysicsPlayground.tsx#L197-641`:
  - `[PointerTrace]`, `[Gesture]`, `[Drop]`, `[Run4/5/6/7]`, `[Dev]` -> Should be DEV-gated
  - Topology and physics wiring logs are helpful for diagnostics but noisy in prod.
- `src/playground/useGraphRendering.ts#L185-204`:
  - Pointer trace and stuck lock logs -> Should be DEV-gated
- `src/playground/rendering/graphRenderingLoop.ts#L296-548`:
  - Pointer trace, stuck lock, render spike logs -> Should be DEV-gated
- `src/store/documentStore.tsx#L102-113`:
  - `[DocumentStore]` parse logs -> Should be DEV-gated
- `src/popup/PopupStore.tsx#L27-150`:
  - `[Popup]`, `[MiniChatAI]` logs -> Should be DEV-gated
- `src/fullchat/FullChatStore.tsx#L31-221`:
  - `[FullChat]`, `[AI_SEND]`, `[Prefill]` logs -> Should be DEV-gated
- `src/fullchat/FullChatbar.tsx#L130-598`:
  - Prefill perf and state logs -> Should be DEV-gated
- `src/components/TestBackend.tsx`:
  - Dev-only UI panel -> Safe to delete or keep behind DEV flag
- `src/server/src/index.ts#L43-300`:
  - CORS allow/block, auth session logs -> Must remain (ops visibility), but consider log level control

Additional debug-only modules:
- `src/graph/devTopologyHelpers.ts` and `src/graph/devKGHelpers.ts` are DEV-only imports and are safe.

## Files Inspected
- `src/playground/GraphPhysicsPlayground.tsx`
- `src/playground/useGraphRendering.ts`
- `src/playground/rendering/graphRenderingLoop.ts`
- `src/playground/graphPlaygroundStyles.ts`
- `src/playground/components/CanvasOverlays.tsx`
- `src/components/AnalysisOverlay.tsx`
- `src/components/TestBackend.tsx`
- `src/auth/SessionExpiryBanner.tsx`
- `src/components/GoogleLoginButton.tsx`
- `src/fullchat/FullChatbar.tsx`
- `src/fullchat/FullChatbarStyles.ts`
- `src/fullchat/FullChatStore.tsx`
- `src/fullchat/FullChatToggle.tsx`
- `src/popup/PopupOverlayContainer.tsx`
- `src/popup/NodePopup.tsx`
- `src/popup/MiniChatbar.tsx`
- `src/popup/PopupStore.tsx`
- `src/store/documentStore.tsx`
- `src/api.ts`
- `src/main.tsx`
- `src/server/src/index.ts`
- `vercel.json`
- `vite.config.ts`
- `.env.local` (only to confirm `VITE_API_BASE_URL` value)
- `.env.production` (only to confirm `VITE_API_BASE_URL` value)
