# Report: EnterPrompt Text to Analyzer Forensic
Date: 2026-02-09

## Summary Recommendation
Use option B: keep `DocumentProvider` scoped to graph and add a tiny pending-analysis handoff state at `AppShell` level. This is the smallest diff that avoids re-rooting providers and avoids touching auth/fullchat/doc-viewer ownership broadly. `EnterPrompt` only needs to capture editable text and submit it; graph then consumes that payload exactly once and runs the existing `applyAnalysisToNodes` pipeline.

For stable UX, submit should transition to graph immediately, then graph performs analysis once after initial graph spawn. Keep existing loading behavior (`LoadingScreen`) and existing money/auth error handling from `paperAnalyzer.ts` and `nodeBinding.ts`; do not add new toast/panel systems.

## 1) EnterPrompt UI Reality (Current)
- `EnterPrompt` mounts `PromptCard` directly with no props at `src/screens/EnterPrompt.tsx:39`.
- `EnterPrompt` props exist (`onEnter`, `onBack`, `onSkip`, `onOverlayOpenChange`) at `src/screens/EnterPrompt.tsx:10` to `src/screens/EnterPrompt.tsx:13`.
- Login overlay is hard-disabled: `false && <LoginOverlay ...>` at `src/screens/EnterPrompt.tsx:43`.
- `PromptCard` has no callback props and no submit API (`React.FC` with no props) at `src/components/PromptCard.tsx:7`.
- Textarea is read only at `src/components/PromptCard.tsx:41`.
- Send button is visual only; no click handler for submit at `src/components/PromptCard.tsx:63` to `src/components/PromptCard.tsx:70`.
- No keyboard submit handling (`onKeyDown` missing) in `src/components/PromptCard.tsx`.
- Prompt copy source:
  - EN placeholder at `src/i18n/strings.ts:181`
  - ID placeholder at `src/i18n/strings.ts:84`

## 2) Working Analyzer Truth Path (Reuse Path)
- DnD entrypoint: `onDrop={handleDrop}` at `src/playground/GraphPhysicsPlayground.tsx:693`.
- `handleDrop` starts at `src/playground/GraphPhysicsPlayground.tsx:339`.
- Parse path: `documentContext.parseFile(file)` at `src/playground/GraphPhysicsPlayground.tsx:358`.
- Temporary label bind: `applyFirstWordsToNodes(...)` at `src/playground/GraphPhysicsPlayground.tsx:362`.
- Main analysis bind: `applyAnalysisToNodes(...)` at `src/playground/GraphPhysicsPlayground.tsx:367`.
- In node binding:
  - `analyzeDocument(documentText, { nodeCount })` at `src/document/nodeBinding.ts:67`
  - `setTopology(...)` at `src/document/nodeBinding.ts:130`
  - derive/reuse springs at `src/document/nodeBinding.ts:138`
  - convert springs to physics links at `src/document/nodeBinding.ts:139`
  - engine rewiring (`engine.clear`, `addNode`, `addLink`) at `src/document/nodeBinding.ts:142` to `src/document/nodeBinding.ts:144`
- `paperAnalyzer` backend call: `apiPost('/api/llm/paper-analyze', ...)` at `src/ai/paperAnalyzer.ts:46`.

Minimal callable function for raw pasted text (no file parse):
1. `applyAnalysisToNodes(engine, rawText, docId, getCurrentDocId, setAIActivity, setAIError, setInferredTitle)` in `src/document/nodeBinding.ts:42`.

Optional for UI parity (doc viewer/title fallback):
1. `documentContext.setDocument(syntheticParsedDocument)` in `src/store/documentStore.tsx:127`.

## 3) Provider/State Ownership Blocker
- `DocumentProvider` is mounted only inside graph wrapper at `src/playground/GraphPhysicsPlayground.tsx:843`.
- `EnterPrompt` runs in `AppShell` before graph mount (`screen === 'prompt'`) and cannot access `useDocument()` today:
  - screen routing at `src/screens/AppShell.tsx:144` and `src/screens/AppShell.tsx:188`
  - graph mounts only when `screen === 'graph'` at `src/screens/AppShell.tsx:144`
- Therefore EnterPrompt cannot directly run analyzer state today.

Cleanest minimal seam: option B
- Add pending payload state in `AppShell` (or tiny onboarding handoff store), pass setter to `EnterPrompt`, then pass payload to graph component when screen switches to graph.
- Do not lift `DocumentProvider` unless larger cross-screen state unification is also planned.

## 4) Where Pending Text Should Be Applied in Graph
- Graph shows analysis/loading by short-circuiting to `LoadingScreen` when AI is active/error:
  - `if (documentContext.state.aiActivity || aiErrorMessage) return <LoadingScreen ...>` at `src/playground/GraphPhysicsPlayground.tsx:63` to `src/playground/GraphPhysicsPlayground.tsx:64`.
- Initial graph topology spawn runs in mount effect at `src/playground/GraphPhysicsPlayground.tsx:539` to `src/playground/GraphPhysicsPlayground.tsx:541`.

Earliest safe one-shot seam:
1. Add a post-mount effect in `GraphPhysicsPlaygroundInternal` that checks pending text prop.
2. Gate with `useRef` to run once.
3. Ensure nodes are present (after initial spawn) before calling `applyAnalysisToNodes`.
4. Clear consumed payload immediately after starting run to prevent duplicate run.

## 5) Auth and Backend Contract Constraints
- `/api/llm/paper-analyze` is auth-gated: `app.post("/api/llm/paper-analyze", requireAuth, ...)` at `src/server/src/index.ts:794`.
- If not logged in, backend returns unauthorized via `requireAuth` at `src/server/src/index.ts:352`.
- Frontend analyzer handles 401/403 and throws `unauthorized` at `src/ai/paperAnalyzer.ts:52` to `src/ai/paperAnalyzer.ts:54`.
- `applyAnalysisToNodes` maps this to user-safe message via `setAIError` at `src/document/nodeBinding.ts:160` to `src/document/nodeBinding.ts:163`.
- Balance precheck exists in `paperAnalyzer.ts`:
  - estimate and gate at `src/ai/paperAnalyzer.ts:39` to `src/ai/paperAnalyzer.ts:40`
  - shortage UX calls at `src/ai/paperAnalyzer.ts:86` and `src/ai/paperAnalyzer.ts:92`

Expected submit behavior if not logged in:
- Transition to graph can still happen, but analysis call will fail with unauthorized and show current loading/error surface.
- If you want strict gate before transition, enforce auth check in EnterPrompt submit path before setting pending payload.

## Files To Edit (Implementation Step, Not Done Yet)
1. `src/components/PromptCard.tsx`
2. `src/screens/EnterPrompt.tsx`
3. `src/screens/AppShell.tsx`
4. `src/playground/GraphPhysicsPlayground.tsx`
5. `src/document/types.ts` (only if adding explicit pending payload typing)
6. `src/i18n/strings.ts` (only if submit/auth helper copy needs update)

## One-Shot Flow Diagram (Desired)
`EnterPrompt textarea paste`
-> `Submit click/Enter`
-> `AppShell set pendingAnalysisPayload + setScreen('graph')`
-> `Graph mounts + initial spawnGraph`
-> `Graph one-shot effect consumes pending payload`
-> `applyAnalysisToNodes(rawText)`
-> `analyzeDocument -> /api/llm/paper-analyze`
-> `setTopology`
-> `deriveSpringEdges`
-> `springEdgesToPhysicsLinks`
-> `engine clear/addNode/addLink/resetLifecycle`
-> `Map ready`

## Risks and Footguns
- Double run on mount (React StrictMode/effect re-run): must guard with consumed ref and payload clear.
- Stale payload replay on back/forward or remount: clear payload after consume and on failed consume paths.
- Race with initial spawn graph: run analysis only after nodes exist, or deterministicly re-spawn before analysis.
- `PERSIST_SCREEN = false` at `src/screens/AppShell.tsx:20`: refresh drops onboarding state and any in-memory pending payload.
- Auth-disabled overlay in EnterPrompt: submit can happen while logged out unless explicitly gated.
- Existing stale-doc check in `applyAnalysisToNodes` depends on `getCurrentDocId`; for pending-text path, pass a real mutable current-doc source, not a constant closure.
