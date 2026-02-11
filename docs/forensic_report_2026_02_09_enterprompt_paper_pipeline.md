# Forensic Report: EnterPrompt to Paper Analyzer Wiring
Date: 2026-02-09
Scope: Trace current paper ingestion and analysis pipeline, map why `src/screens/EnterPrompt.tsx` is disconnected, and identify persistence seams for session-based reuse.

## 1. Executive Summary
- The working analysis pipeline exists, but only on graph-screen drag and drop.
- `EnterPrompt` and `PromptCard` are currently visual only. Textarea is `readOnly`, upload popup is cosmetic, send button has no handler.
- `paperAnalyzer` itself already supports raw text input. You do not need file parsing if user pastes text.
- Graph body after analysis is built as:
  1. Dot labels and meta from `main_points`
  2. Directed knowledge links from `links`
  3. Derived undirected springs for physics
  4. Physics engine link rewiring
- Session persistence exists for auth (`sessions` table) but not for analysis results or topology snapshots yet.

## 2. Current Working Pipeline (Upload to Graph)

### 2.1 Entry point and trigger timing
- Entry trigger is graph canvas drop, not onboarding prompt.
- `onDrop={handleDrop}` in `src/playground/GraphPhysicsPlayground.tsx:693`.
- Drop handler starts at `src/playground/GraphPhysicsPlayground.tsx:339`.

### 2.2 Parse stage (worker)
- Graph drop calls `documentContext.parseFile(file)` at `src/playground/GraphPhysicsPlayground.tsx:358`.
- `DocumentStore.parseFile` dispatches parsing state and worker parse in `src/store/documentStore.tsx:106`, `src/store/documentStore.tsx:109`.
- Worker client sends file to worker in `src/document/workerClient.ts:75`, `src/document/workerClient.ts:87`.
- Worker selects parser and extracts text in `src/document/documentWorker.ts:41`, `src/document/documentWorker.ts:53`.

### 2.3 Analysis stage (LLM)
- Immediate placeholder binding first: `applyFirstWordsToNodes` at `src/playground/GraphPhysicsPlayground.tsx:362`.
- Real AI pass next: `applyAnalysisToNodes` at `src/playground/GraphPhysicsPlayground.tsx:367`.
- `applyAnalysisToNodes` calls `analyzeDocument(documentText, { nodeCount })` in `src/document/nodeBinding.ts:67`.
- `paperAnalyzer` calls backend `POST /api/llm/paper-analyze` in `src/ai/paperAnalyzer.ts:46`.
- Request text is truncated to 6000 chars at `src/ai/paperAnalyzer.ts:38`.
- Balance precheck is enforced at `src/ai/paperAnalyzer.ts:40`.

### 2.4 Topology and physics rewrite
- AI points and links are mapped to graph structures in `src/document/nodeBinding.ts:78`, `src/document/nodeBinding.ts:97`.
- Topology mutation uses required seam `setTopology(...)` at `src/document/nodeBinding.ts:130`.
- `setTopology` recomputes springs internally (`deriveSpringEdges`) in `src/graph/topologyControl.ts:203`, `src/graph/topologyControl.ts:249`.
- Node binding then converts springs to physics links and rewires engine at:
  - `src/document/nodeBinding.ts:138`
  - `src/document/nodeBinding.ts:139`
  - `src/document/nodeBinding.ts:142`
- Spring derivation deduplicates directed links to undirected springs in `src/graph/springDerivation.ts:34`, `src/graph/springDerivation.ts:228`.

## 3. EnterPrompt Path (Current State)

### 3.1 What exists
- Prompt screen mounted via AppShell `prompt` state in `src/screens/AppShell.tsx:188`.
- `PromptCard` rendered in `src/screens/EnterPrompt.tsx:39`.
- Placeholder text promises paste or drop in `src/i18n/strings.ts:181`.

### 3.2 What is disconnected
- Textarea is read-only in `src/components/PromptCard.tsx:41`.
- Upload popup item has no file input or callback in `src/components/PromptCard.tsx:59`.
- Send icon is visual only (hover only, no submit handler) in `src/components/PromptCard.tsx:67`.
- Login overlay is hard-disabled by `false && <LoginOverlay` in `src/screens/EnterPrompt.tsx:43`.
- `onEnter/onSkip/onBack` wiring exists only via disabled overlay path.

### 3.3 System-level disconnect
- `DocumentProvider` is mounted only inside graph playground wrapper at `src/playground/GraphPhysicsPlayground.tsx:843`.
- `EnterPrompt` is outside that provider, so it cannot currently call `useDocument()`.
- Therefore prompt screen cannot reuse parse/analyze/loading/title pipeline without lifting provider or adding a bridge action.

## 4. Backend Contract for Analyzer
- Endpoint is auth-gated: `app.post("/api/llm/paper-analyze", requireAuth, ...)` at `src/server/src/index.ts:794`.
- Validation enforces text and node count via `validatePaperAnalyze` (`src/server/src/index.ts:875`, `src/server/src/llm/validate.ts:55`).
- Structured schema enforces:
  - `paper_title`
  - `main_points` length equals nodeCount
  - `links` object array
  in `src/server/src/llm/analyze/schema.ts:33`, `src/server/src/llm/analyze/schema.ts:69`, `src/server/src/llm/analyze/schema.ts:106`.
- Success payload shape is `{ ok: true, request_id, json }` at `src/server/src/index.ts:1308`.

## 5. Graph Body Result After Successful Analysis

### 5.1 Data shape produced
- Dots (`engine.nodes`) get new `label` and `meta.sourceTitle/sourceSummary` from `main_points` in `src/document/nodeBinding.ts:84`.
- Directed links array built from LLM index pairs in `src/document/nodeBinding.ts:97`.
- Invalid links are dropped (missing index or self-loop) at `src/document/nodeBinding.ts:102`.

### 5.2 Topology layer
- Final topology object:
  - `nodes: NodeSpec[]`
  - `links: DirectedLink[]`
  - `springs: SpringEdge[]` (derived)
  from `src/graph/topologyTypes.ts:46`, `src/graph/topologyTypes.ts:50`, `src/graph/topologyTypes.ts:53`.

### 5.3 Physics layer
- Springs are converted to engine links via `springEdgesToPhysicsLinks` in `src/document/nodeBinding.ts:139`.
- Engine is fully rewired (`clear`, `addNode`, `addLink`, `resetLifecycle`) at `src/document/nodeBinding.ts:142`.

### 5.4 User-visible effects
- Map title becomes inferred paper title via document store (`setInferredTitle`) and `MapTitleBlock` fallback logic:
  - `src/document/nodeBinding.ts:150`
  - `src/playground/components/MapTitleBlock.tsx:49`

## 6. Conflicts, Overlaps, and Drift Found

### 6.1 Functional conflicts
- Prompt copy says paste or drop, but prompt input is non-editable (`readOnly`) and non-submit.
- Prompt route has no active transition control to graph because login overlay is disabled.

### 6.2 Architectural overlap
- Document state is scoped to graph screen only; onboarding prompt cannot share same document state or AI activity state.
- This is the main intersystem seam blocking reuse.

### 6.3 Contract drift vs docs
- `docs/system.md` describes top-level `AnalysisOverlay`, but runtime currently uses full-screen `LoadingScreen` return path when `aiActivity` is true (`src/playground/GraphPhysicsPlayground.tsx:64`).
- `AnalysisOverlay` component exists but has no usage references (`src/components/AnalysisOverlay.tsx:37`).

### 6.4 Additional risk signals
- Existing mojibake characters in several source comments and strings (example in `src/components/Sidebar.tsx`) conflict with ASCII-only doctrine.
- `src/screens/AppShell.tsx:20` sets `PERSIST_SCREEN = false`, so prompt progress is not retained.

## 7. What Must Be Wired for EnterPrompt Text -> Normal Analyzer Flow

### 7.1 Minimum frontend wiring
1. Make `PromptCard` controlled input (remove `readOnly`, add `value/onChange`).
2. Add `onSubmit` callback on send button and Enter key.
3. In `EnterPrompt`, pass input text and submit handler.
4. On submit, transition to graph and hand off a pending analysis payload (raw text + optional title).

### 7.2 Provider/state wiring options
- Option A (cleaner): Lift `DocumentProvider` above `AppShell` so prompt and graph share one store.
- Option B (minimal diff): Keep provider in graph, but pass pending text through a small onboarding handoff store (or AppShell state) consumed by graph on mount.

### 7.3 Reuse existing analyzer path
- Use `applyAnalysisToNodes(engine, text, docId, ...)` directly. It already accepts plain text, not file-only input.
- For pasted text, synthesize a `ParsedDocument` object (id/fileName/sourceType=text/meta counts) so UI panels still work.

### 7.4 Graph output expectation after wiring
- End result will be identical to drop-upload path: same analyzer endpoint, same topology mutation seam, same spring derivation and engine rewiring.

## 8. Session Storage and Reuse: Where to Insert

### 8.1 Existing session foundation
- Cookie session already works with `sessions` table and `/me` truth source:
  - `requireAuth` session check at `src/server/src/index.ts:352`
  - login creates session at `src/server/src/index.ts:585`
  - `/me` reads session at `src/server/src/index.ts:631`

### 8.2 Missing persistence for analysis outputs
- No table or endpoint stores analyzer result payload (`paper_title/main_points/links`) for retrieval.
- Current DB migrations include payments, rupiah, audit, and free-pool ledgers, but no analysis-result table.

### 8.3 Recommended storage seam
- Add backend table for analysis cache/history keyed by `user_id + content_hash` with columns:
  - `id`, `user_id`, `content_hash`, `input_excerpt`, `node_count`, `analysis_json`, `topology_json`, `created_at`, `last_used_at`.
- On `POST /api/llm/paper-analyze`:
  - compute deterministic hash of normalized input text and nodeCount
  - return cached result when hash hit
  - otherwise run provider call, then persist result
- Add read endpoint (`GET /api/analysis/latest` or list) to allow prompt preload and graph resume.

### 8.4 Frontend reuse seam
- On prompt submit, compute local hash and ask backend cache first.
- If hit: skip LLM call and apply stored graph body.
- If miss: run current analyzer flow and persist through backend.

## 9. Direct Answer to Your Plan
Yes, your plan is feasible with current architecture. `src/ai/paperAnalyzer.ts` already accepts raw text and can be reused as-is. The missing work is prompt input and submit wiring, plus a cross-screen handoff into graph where `DocumentProvider` and engine access exist.

## 10. Quick File Index (Primary Touchpoints)
- Prompt UI: `src/screens/EnterPrompt.tsx`, `src/components/PromptCard.tsx`
- Onboarding orchestration: `src/screens/AppShell.tsx`
- Parse state: `src/store/documentStore.tsx`
- Worker parsing: `src/document/workerClient.ts`, `src/document/documentWorker.ts`
- AI binding: `src/document/nodeBinding.ts`, `src/ai/paperAnalyzer.ts`
- Topology seam: `src/graph/topologyControl.ts`, `src/graph/springDerivation.ts`
- Graph runtime: `src/playground/GraphPhysicsPlayground.tsx`
- Backend analyzer/auth: `src/server/src/index.ts`, `src/server/src/llm/analyze/schema.ts`, `src/server/src/llm/validate.ts`
