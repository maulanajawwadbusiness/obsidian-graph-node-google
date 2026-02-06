# App Flow Forensic Report
Date: 2026-02-06
Scope: routing, auth placement, API base assumptions, graph page composition, debug inventory

## Repo Map (Entry -> Routing -> Pages/Components)
- Entry point: `src/main.tsx`
- Root component: `GraphPhysicsPlayground` from `src/playground/GraphPhysicsPlayground.tsx`
- Router: none found (no react-router, no Routes/Route usage).
- Providers in entry: `GoogleOAuthProvider` -> `AuthProvider` -> `GraphPhysicsPlayground`
- Providers inside graph page: `DocumentProvider` -> `PopupProvider` -> `FullChatProvider` -> `GraphPhysicsPlaygroundInternal`

## Current App Flow (As-Is)
1) `main.tsx` boots React with `GoogleOAuthProvider` and `AuthProvider`.
2) `AuthProvider` calls `/me` once on mount and on window focus to establish session state.
3) `GraphPhysicsPlaygroundInternal` constructs the physics engine via `useRef` (single instance per mount).
4) `useGraphRendering` starts the render loop and hover controller (canvas-based).
5) The main container handles pointer + drag/drop events and hosts the canvas.
6) Global overlays and panels are layered inside the graph container: `CanvasOverlays`, `AnalysisOverlay`, map title, brand label, popup portal, chat toggle.
7) Left preview (`HalfLeftWindow`) and right chat (`FullChatbar`) are conditionally rendered based on state.
8) Auth UI is an overlay: `GoogleLoginButton` (top-right) and `SessionExpiryBanner` (top bar).
9) There is no route-based gating; the graph page is always mounted.

## Proposed Flow Insertion Points (No Implementation)
- Recommendation: introduce a top-level screen controller that wraps the existing providers and conditionally renders pages.
  - Option A: Create a new root component (e.g., `AppShell`) and mount it in `main.tsx` in place of `GraphPhysicsPlayground`.
  - Option B: Keep `GraphPhysicsPlayground` as-is, and add a new wrapper above it in `main.tsx` to choose between welcome1, welcome2, prompt, and graph.
- Welcome1/Welcome2/Prompt pages should live at the top of the tree where routing or a state machine can switch screens without touching the physics internals.
- Login overlay should attach to the Prompt page (not the graph container), since it is currently an absolute overlay inside the graph.
- Keep `AuthProvider` mounted above all screens so `/me` bootstrap and session state remain stable across screen changes.

## Risks + Invariants
- Auth state must remain single-source-of-truth via `AuthProvider` (`/me` bootstrap, `sessionExpired` handling).
- `GraphPhysicsPlaygroundInternal` re-initializes the physics engine on mount. If you unmount it between screens, the engine and render loop will be recreated.
- The graph page assumes it owns pointer events on the main container. Any overlay or new page layer must stop propagation for pointerdown to avoid canvas capture issues.
- The render loop and window listeners (keydown, blur) are registered on mount; avoid double-mounting.
- `/api` rewrite exists in `vercel.json`, but the frontend uses `VITE_API_BASE_URL` directly. Changing to same-origin `/api` would be a behavior change.

## Findings By Requirement

### A) Current navigation / routing
- No react-router found. No `Routes`, `Route`, `createBrowserRouter`, or similar.
- Entry point: `src/main.tsx`.
- Root component: `GraphPhysicsPlayground`.
- Graph map page is the root; no multi-screen routing. It is a single screen with conditional UI panels.

### B) Current auth placement
- `AuthProvider` is mounted in `src/main.tsx` around the entire app.
- `GoogleLoginButton` is rendered inside `GraphPhysicsPlaygroundInternal` as a top-right overlay.
- `SessionExpiryBanner` is rendered inside the graph container, above the canvas.
- There is no route gating; auth is a UI state (login button, session expired banner).

### C) API base + deployment assumptions
- `VITE_API_BASE_URL` is used in `src/api.ts`, `src/auth/AuthProvider.tsx`, and `src/components/GoogleLoginButton.tsx`.
- `apiGet` uses `credentials: 'include'` for backend calls.
- Google login and logout fetch calls use `credentials: 'include'`.
- Other fetches (OpenAI client, PDF viewer) do not include credentials because they are not the backend auth endpoints.
- `vercel.json` rewrites `/api/*` to Cloud Run, but the frontend does not use `/api` paths today; it uses the full `VITE_API_BASE_URL`.

### D) Main UI structure that must not break
- Top-level graph page component: `GraphPhysicsPlaygroundInternal` in `src/playground/GraphPhysicsPlayground.tsx`.
- Core engine and loop:
  - Engine constructed in `GraphPhysicsPlaygroundInternal` via `useRef`.
  - `useGraphRendering` starts the render loop (`startGraphRenderLoop`) and hover controller.
- Core layers (inside the main container):
  - `SessionExpiryBanner`
  - `<canvas>` (render surface)
  - `CanvasOverlays`
  - `TextPreviewButton`
  - `AIActivityGlyph`
  - `AnalysisOverlay`
  - `MapTitleBlock`, `BrandLabel`
  - `PopupPortal`, `RotationCompass`
  - `FullChatToggle`
  - `GoogleLoginButton` overlay (top-right)
- Conditional panels:
  - `HalfLeftWindow` for document preview (left side)
  - `SidebarControls` when `sidebarOpen` and not `fullChatOpen`
  - `FullChatbar` when `fullChatOpen`

### E) Logging/debug cleanup targets (inventory only)
- Dev-only imports: `src/graph/devTopologyHelpers.ts`, `src/graph/devKGHelpers.ts` (loaded only in DEV).
- Debug panels and toggles:
  - `TestBackend` (manual `/health` test panel) in `src/components/TestBackend.tsx`
  - `CanvasOverlays` and `SidebarControls` include debug toggles for grids, markers, metrics
  - `showPresetHUD` block in `GraphPhysicsPlaygroundInternal`
- Console logging files (inventory):
  - `src/main.tsx`
  - `src/api.ts`
  - `src/auth/AuthProvider.tsx`
  - `src/components/GoogleLoginButton.tsx`
  - `src/components/TestBackend.tsx`
  - `src/playground/GraphPhysicsPlayground.tsx`
  - `src/playground/useGraphRendering.ts`
  - `src/playground/rendering/*` (multiple files)
  - `src/physics/*` and `src/physics/engine/*`
  - `src/graph/*` (topology control, dev helpers, providers)
  - `src/fullchat/*`
  - `src/popup/*`
  - `src/document/*` and `src/store/documentStore.tsx`
  - `src/ai/*`
  - `src/ArnvoidDocumentViewer/*`

## Files Inspected
- `docs/repo_xray.md`
- `src/main.tsx`
- `src/playground/GraphPhysicsPlayground.tsx`
- `src/playground/useGraphRendering.ts`
- `src/auth/AuthProvider.tsx`
- `src/auth/SessionExpiryBanner.tsx`
- `src/components/GoogleLoginButton.tsx`
- `src/components/TestBackend.tsx`
- `src/api.ts`
- `vercel.json`
