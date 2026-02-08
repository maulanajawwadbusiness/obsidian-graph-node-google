# AGENTS.md: Developer Doctrine

## 1. The Doctrine

### A. 60fps Is Sacred (No Syrup)
Jitter, layout thrashing, and frame drops are critical bugs.
*   **0-Slush Scheduler**: Time must remain 1:1 with reality. If the renderer falls behind, **Drop Debt** (Stutter).
*   **Zero Thrash**: Input handlers must never touch the DOM (Caching).
*   **Decouple**: Input sampled asynchronously; Ticked synchronously in `rAF` (Fix 34).
*   **Throttle**: All scroll/resize handlers (~50ms).
*   **Bounds**: Work per frame must be bounded.

### B. Panels = Input Black Holes
The Canvas (Graph) is the substrate. Panels (Chat, Docs) and the Loading Screen float above it.
*   **Rule**: When a panel is active, it must own 100% of the input events.
*   **Shielding**: The `LoadingScreen` must block pointer + wheel events completely.
*   **Drag Authority**: When dragging a dot, it must follow the cursor 1:1. Physics forces are ignored for the dragged node.

### C. Minimal Diffs & Side Reports
*   **Touch only what is necessary**. Prefer modular hooks over monolithic components.
*   **Mission Protocol**: Every major work block (e.g., performance fixes, refactors) MUST be accompanied by a side report in `docs/` and a corresponding git commit.
*   **Future TODOs**: Refer to `docs/FUTURE_TODO.md` when asked for upcoming work and acknowledge the gaps listed there before starting new features.

## 2. Project Map

| Domain | Path | Description |
| :--- | :--- | :--- |
| **Physics/Graph** | `src/physics/` | Hybrid solver (forces + PBD + diffusion) and WebGL renderer. |
| **Paper Analyzer** | `src/ai/paperAnalyzer.ts` | The "Essence" distiller (Main Topic + 4 Points). |
| **Full Chat** | `src/fullchat/` | Right panel. `FullChatStore` + `fullChatAi` module. |
| **Mini Chat** | `src/popup/` | Node popover chat logic (`PopupStore.tsx`). |
| **Document Pipe** | `src/store/documentStore.tsx` | Worker-based parsing (PDF/TXT/MD). |
| **UI Markers** | `src/playground/components/` | `BrandLabel` (Top-Left) and `MapTitleBlock` (Title). |
| **DB Ops** | `docs/db.md`, `src/server/scripts`, `src/server/migrations` | Laptop-first DB workflow and migrations. |
| **LLM Usage/Billing** | `src/server/src/llm/usage`, `src/server/src/llm/audit`, `src/server/src/pricing` | Usage tracking, audit persistence, and rupiah pricing. |

## 3. Safe Workflow

1.  **Scan**: Read `docs/repo_xray.md`.
    *   **Physics Work**: **STOP.** Read `docs/PHYSICS_ATLAS.md` first. The Acceptance Tests (T1–T7) are your Truth Harness.
    *   **Render/DPR Work**: Read `docs/onboarding_dpr_rendering.md`. **Mandatory for avoiding visual regressions.**
    *   **DB Work**: Read `docs/db.md` and run DB tasks from `src/server` using npm scripts.
    *   Do not guess.
2.  **Dissect**: Identify load-bearing logic (runIds, refs, context priorities).
3.  **Instrument**: Add minimal metrics/logs before changing behavior.
4.  **Implement**: Make small, verifiable changes. Use `console.log` tags like `[PhysicsPerf]`.
5.  **Verify**: Manual verification is required.
6.  **Docs**: Update `docs/*.md` to reflect new truth.
7.  **Commit**: Use compact, descriptive messages (`feat(chat): ...`).
    *   **Staging Rule**: When preparing a commit, stage all current untracked files by default to avoid conflict drift.
    *   **ENV Exception**: Do NOT stage any untracked file if its path or filename contains `env`.
    *   **Auth Work**: Update `docs/report_2026_02_05_auth_session_postgres.md` when touching auth, session, or CORS behavior.

## 4. CRITICAL WARNINGS

### Use `task_boundary` Sparingly (3+2 Rule)
Only use `task_boundary` for distinct, complex sub-tasks (~1 per 5 steps).
**NEVER use Browser Testing Tools.**

### POWERSHELL CAUTION
Do NOT use `&&` in the terminal. It breaks the parser. Use separate commands or use `;` correctly.

### ASCII ONLY
Use pure ASCII characters in code, comments, logs, and docs. Avoid Unicode arrows, ellipses, and typographic dashes to prevent mojibake.

### AUTH COOKIE RULES
*   **Frontend**: All backend calls must include `credentials: "include"`.
*   **Cookie**: Session cookie is `arnvoid_session` and must be cleared with matching options (path, sameSite, secure).
*   **Vercel Proxy**: If frontend is `https://beta.arnvoid.com`, backend CORS must allow that origin.

### AUTH SAFETY + SHARPNESS
*   **Single Truth**: `/me` is the only source of truth for logged-in user state.
*   **No Local Storage**: Never store tokens in localStorage or sessionStorage.
*   **Credentials Required**: All auth requests must use `credentials: "include"`.
*   **CORS Discipline**: Never set CORS origin to `*` when credentials are enabled.
*   **No Secret Logs**: Never log idTokens, cookies, or auth headers.
*   **Origin Changes**: When OAuth origins change, document exact allowed origins.
*   **Movable UI**: Keep auth UI components easy to relocate (no hard-coupling).

### DO NOT Break The "Dot"
Terminology matters. In the graph, we render "Dots", not "Nodes" (though the data structure is a node). Keep performance-first language.

### 0-Dependency Philosophy
*   **Default Stance**: Prioritize standard Web APIs over third-party libraries.
*   **Heuristic**: "Can this be written robustly in <100 lines?" If yes, own the code.

### TOPOLOGY MUTATION SEAM (NON-NEGOTIABLE)
*   **Rule**: All topology changes MUST go through `setTopology()` or `patchTopology()` in `src/graph/topologyControl.ts`.
*   **Springs**: Never set `topology.springs` directly. Springs are derived from directed knowledge links.
*   **Config**: Always pass a `ForceConfig` (or `DEFAULT_PHYSICS_CONFIG`) when mutating topology so rest-length policy is consistent.
*   **Direct Mutation Ban**: Do NOT mutate or replace topology data outside the control API (including in dev helpers).
*   **Fallback Is Not A Contract**: The `getTopology()` fallback derive is a safety net, not a substitute for correct mutation.

### EDGE LENGTH GAP (CURRENT)
*   **Gap**: XPBD constraints currently use spawn distance as rest length, not `linkRestLength`.
*   **Visible Knobs**: Use `targetSpacing` or the mapping policy rest length scale to change visible edge length.
*   **Not Effective**: `linkRestLength` does NOT change XPBD edge length today.
*   **Unification Fix**: Use per-link rest length in `engineTickXPBD.ts` when building constraints.

### POINTER CAPTURE BUBBLING (Visual UI)
*   **Problem**: In `GraphPhysicsPlayground`, the parent container captures the pointer on `pointerdown` for drag handling.
*   **Risk**: Any UI button (Overlay, Toggle) that sits on top MUST stop propagation of `onPointerDown`.
*   **Symptom**: If you skip this, the button will "click" visually (hover works) but the parent will steal the logic click.
*   **Rule**: Always add `onPointerDown={(e) => e.stopPropagation()}` to **ALL** interactive overlay elements. DO NOT FORGET IT.

### POINTER SAFETY (NON-NEGOTIABLE)
*   **Never break pointer detection or click**. Assume the canvas will steal pointerdown unless you explicitly shield overlays.
*   **2x Thought Rule**: Before shipping any overlay/window/UI control, re-check pointer flow and verify click + close + drag.
*   **Safe Overlay Pattern**:
    1.  **Container**: `pointerEvents: 'auto'` on the overlay wrapper.
    2.  **Shield**: Add `onPointerDown={(e) => e.stopPropagation()}` on the wrapper **and** on every interactive child (buttons, inputs, toggles).
    3.  **Backdrop**: For click-outside-to-close, use a full-screen backdrop with `pointerEvents: 'auto'`, `onPointerDown` stop, and `onClick` close.
    4.  **Panels Own Input**: When an overlay/panel is open, it must fully own pointer + wheel events inside its bounds.

### SECRETS POLICY (NON-NEGOTIABLE)
*   **Never paste or store secrets** in repo files or logs. Always redact values.
*   **No secret logs**: Do not log tokens, cookies, auth headers, or keys.
*   **Docs**: Use placeholders like `<REDACTED>` only. Never include real values.

## 5. Perf Doctrine (Physics)

### A. The Scheduler
*   **Invariant**: `accumulatorMs` never exceeds `maxStepsPerFrame * fixedStepMs`.
*   **Failure Mode**: If we fall behind, we hard-reset (`droppedMs`). We prefer visual stutter (teleport) over temporal lag (syrup).

### B. Adaptive Gating
*   **Energy Gate**: Expensive passes (Spacing) run only when energy allows.
*   **Phase Staggering**: Split heavy O(N) or O(N²) work across multiple frames (prime modulo staggering).
*   **Safety Limits**: If N/E exceed the safe envelope, degradations trigger automatically (Stressed -> Fatal).

## 6. AI Doctrine

### A. Current Rules
*   **Responses API**: The OpenAI path MUST use the `v1/responses` endpoint.
*   **Strict Param Hygiene**: `maxCompletionTokens` (YES), `response_format` (YES).
*   **Context**: Intelligence is relative. Always prefer `pendingContext` (Content Title/Summary) over generic document text.

### B. Streaming
*   **SDK-Defined Boundaries**: The Provider/SDK defines logic chunks. Do not reshape in transport.
*   **No Smoothing**: Do not "smooth" text stream in the client. Visual smoothing is a UI concern (CSS).
*   **Structure**: JSON outputs should be buffered and parsed, not streamed partially.

## 7. Interaction Doctrine
*   **Wake-on-Drag**: Interaction wakes the local cluster to allow settling.
*   **Sleep**: Nodes settle to `isSleeping=true` to save CPU. They wake only on interaction or high energy.
*   **Hand Authority**: User input overrides all physics constraints.

## 8. Font Doctrine (Case #8514)
*   **Default**: `Quicksand` (via `--font-ui` and `data-font="ui"`).
*   **Titles (Exception)**: `Segoe UI` (Windows) -> `Public Sans` (Fallback) -> System. Defined via `--font-title` and `data-font="title"` + `fontWeight: 700`.
*   **No Conflicts**: Do not hardcode font stacks in component styles; inherit from data attributes.
