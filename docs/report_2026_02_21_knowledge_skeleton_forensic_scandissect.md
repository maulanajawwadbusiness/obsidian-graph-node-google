# Knowledge Skeleton Forensic Scandissect (2026-02-21)

## 1. Executive Summary

Current lock is not one single hardcoded `5`, it is a combined template lock:

- Structural lock: graph runtime default spawn is a fixed controlled topology (`4` dots, same ids and shape) in `src/playground/GraphPhysicsPlaygroundShell.tsx:722` and `src/playground/GraphPhysicsPlaygroundShell.tsx:937`.
- Analyzer count lock: analyzer output count is forced to equal current graph dot count (`nodeCount = orderedNodes.length`) in `src/document/nodeBinding.ts:68` and `src/document/nodeBinding.ts:76`.
- Prompt role lock: undercurrent reasoning is always mapped through fixed lens slots (`BASE_LENSES` length `5`) in `src/server/src/llm/analyze/prompt.ts:23` and emitted as index-role guidance in `src/server/src/llm/analyze/prompt.ts:43`.
- Schema lock: output schema enforces exact `main_points.length === nodeCount` via min=max in both frontend and backend schema builders (`src/ai/paperAnalyzer.ts:245`, `src/ai/paperAnalyzer.ts:246`, `src/server/src/llm/analyze/schema.ts:50`, `src/server/src/llm/analyze/schema.ts:51`).
- Validation lock: post-generation validation rejects any count mismatch, missing indices, or link violations (`src/ai/paperAnalyzer.ts:176`, `src/server/src/llm/analyze/schema.ts:116`, `src/server/src/llm/analyze/schema.ts:154`, `src/server/src/llm/analyze/schema.ts:166`).

Important truth as of 2026-02-21 in this worktree: default graph spawn is `4`, not `5` (`src/playground/GraphPhysicsPlaygroundShell.tsx:948`). The hardcoded `5` still exists as analyzer fallback and lens template default (`src/ai/paperAnalyzer.ts:357`, `src/server/src/llm/analyze/prompt.ts:32`).

## 2. Pipeline Diagram + Narrative

### Diagram

`EnterPrompt` text/file submit
-> `renderScreenContent` sets `pendingAnalysis`
-> `GraphPhysicsPlaygroundShell` consumes pending payload
-> (file only) `DocumentStore.parseFile` -> worker parsers
-> `applyAnalysisToNodes`
-> `analyzeDocument`
-> `applyAnalyzeInputPolicy` (optional truncation)
-> frontend POST `/api/llm/paper-analyze`
-> backend `validatePaperAnalyze`
-> backend `buildStructuredAnalyzeInput` + JSON schema
-> provider (`openai responses json_schema` or openrouter prompt-json)
-> backend `validateAnalyzeJson`
-> SSE/json response
-> frontend `assertSemanticAnalyzeJson`
-> point/index binding to existing dots
-> directed link build and sanitize
-> `setTopology` (springs derived)
-> engine rewire (`clear/addNode/addLink/resetLifecycle`)
-> saved interface record + analysisMeta
-> render in graph runtime

Mini preview path is independent from analyzer:

`PromptCard` -> `SampleGraphPreview`
-> load static `sampleGraphPreview.export.json`
-> adapt/validate -> `pendingLoadInterface`
-> graph runtime restore path (no analyzer)

### Narrative (step by step)

1. User input capture:
- Prompt text/file submits through `EnterPrompt` and `PromptCard` (`src/screens/EnterPrompt.tsx:67`, `src/components/PromptCard.tsx:86`).
- AppShell stores pending payload (`src/screens/appshell/render/renderScreenContent.tsx:215`).

2. Analysis trigger:
- Graph runtime consumes pending payload only when graph is mounted and ready (`src/playground/GraphPhysicsPlaygroundShell.tsx:1153`).
- Text path builds synthetic doc (`src/playground/GraphPhysicsPlaygroundShell.tsx:1174`).
- File path parses worker output (`src/playground/GraphPhysicsPlaygroundShell.tsx:1238`).

3. Analyzer call:
- Binder calls `analyzeDocument(documentText, { nodeCount })` where `nodeCount` is existing dot count (`src/document/nodeBinding.ts:68`, `src/document/nodeBinding.ts:76`).

4. Preprocessing/truncation:
- `applyAnalyzeInputPolicy` runs before network call (`src/ai/paperAnalyzer.ts:361`).
- Policy is currently disabled (`src/config/analyzeInputPolicy.ts:6`) with cap value `6000` defined (`src/config/analyzeInputPolicy.ts:7`).

5. Backend prompt+schema:
- Request validated (`src/server/src/llm/validate.ts:72`).
- Prompt built with undercurrent instruction and role guide (`src/server/src/llm/analyze/prompt.ts:81`, `src/server/src/llm/analyze/prompt.ts:105`).
- Schema built with exact count (`src/server/src/llm/analyze/schema.ts:33`).

6. LLM call and response parsing:
- OpenAI path uses Responses API + strict json_schema (`src/server/src/llm/llmClient.ts:74`, `src/server/src/llm/llmClient.ts:201`, `src/server/src/llm/llmClient.ts:204`).
- Openrouter path uses prompt->text->json parse->retry->validate (`src/server/src/llm/analyze/openrouterAnalyze.ts:55`, `src/server/src/llm/analyze/openrouterAnalyze.ts:84`, `src/server/src/llm/analyze/openrouterAnalyze.ts:102`).

7. Post-processing and binding:
- Frontend revalidates structure and semantics (`src/ai/paperAnalyzer.ts:164`, `src/ai/paperAnalyzer.ts:494`).
- Points bind by index to sorted existing dots (`src/document/nodeBinding.ts:66`, `src/document/nodeBinding.ts:91`).
- Links map index->dot id and invalid links are dropped (`src/document/nodeBinding.ts:108`, `src/document/nodeBinding.ts:126`).

8. Graph state and render:
- Topology mutation via `setTopology` only (`src/document/nodeBinding.ts:139`, `src/graph/topologyControl.ts:203`).
- Springs derived internally (`src/graph/topologyControl.ts:249`).
- Engine rewired and rendered (`src/document/nodeBinding.ts:151`, `src/document/nodeBinding.ts:154`).

## 3. Code Entrypoints And Call Graph

Primary runtime chain:

- `src/components/PromptCard.tsx:86` `handleSubmit`
- `src/screens/EnterPrompt.tsx:67` `handlePromptSubmit`
- `src/screens/appshell/render/renderScreenContent.tsx:215` `onSubmitPromptText` / `onSubmitPromptFile`
- `src/playground/GraphPhysicsPlaygroundShell.tsx:1153` pending analysis effect
- `src/document/nodeBinding.ts:50` `applyAnalysisToNodes`
- `src/ai/paperAnalyzer.ts:356` `analyzeDocument`
- `src/server/src/routes/llmAnalyzeRoute.ts:34` `/api/llm/paper-analyze`
- `src/server/src/llm/analyze/prompt.ts:130` `buildStructuredAnalyzeInput`
- `src/server/src/llm/analyze/schema.ts:33` `buildAnalyzeJsonSchema`
- `src/server/src/llm/llmClient.ts:150` `generateStructuredJson`
- `src/server/src/llm/analyze/schema.ts:98` `validateAnalyzeJson`
- `src/document/nodeBinding.ts:139` `setTopology`
- `src/graph/topologyControl.ts:203` `setTopology`
- `src/playground/GraphPhysicsPlaygroundShell.tsx:1487` graph runtime render return

Preview chain (not analyzer):

- `src/components/PromptCard.tsx:126` `<SampleGraphPreview />`
- `src/components/SampleGraphPreview.tsx:265` import static sample export
- `src/components/SampleGraphPreview.tsx:454` pass `pendingLoadInterface`
- `src/playground/GraphPhysicsPlaygroundShell.tsx:976` restore path applies topology/layout

## 4. Current Prompt(s)

### Prompt definition location

- Canonical analyze prompt: `src/server/src/llm/analyze/prompt.ts:81` (`buildCoreInstruction`).
- Frontend imports same prompt builder for dev-direct path too (`src/ai/paperAnalyzer.ts:13`).

### Prompt content that drives template behavior

- Explicit undercurrent framing: `You produce deep undercurrent analysis` (`src/server/src/llm/analyze/prompt.ts:88`).
- Fixed role-guide slots rooted in 5 base lenses (`src/server/src/llm/analyze/prompt.ts:23`).
- Exact-count instruction: `Exactly ${nodeCount} points are required.` (`src/server/src/llm/analyze/prompt.ts:46`).
- Required keys/shape instruction (`src/server/src/llm/analyze/prompt.ts:98` to `src/server/src/llm/analyze/prompt.ts:103`).
- Index completeness requirement (`src/server/src/llm/analyze/prompt.ts:109`).

### Prompt fill inputs

- Text body inserted as `Document excerpt` (`src/server/src/llm/analyze/prompt.ts:136`).
- `nodeCount` from request/body validation (`src/server/src/routes/llmAnalyzeRoute.ts:302`).
- Language directive from `lang` (`src/server/src/llm/analyze/prompt.ts:36`).

### Provider request shape

- OpenAI responses path with strict json_schema (`src/server/src/llm/llmClient.ts:198` to `src/server/src/llm/llmClient.ts:205`).
- Openrouter fallback uses text completion with prompt-embedded schema (`src/server/src/llm/analyze/openrouterAnalyze.ts:55`, `src/server/src/llm/analyze/prompt.ts:157`).

## 5. Current Output Schema And Error Handling

### Expected JSON schema

- Root: `paper_title`, `main_points[]`, `links[]` (`src/server/src/llm/analyze/schema.ts:37`, `src/server/src/llm/analyze/schema.ts:69`).
- `main_points`: `{ index, title, explanation }` (`src/server/src/llm/analyze/schema.ts:43` to `src/server/src/llm/analyze/schema.ts:47`).
- `links`: `{ from_index, to_index, type, weight, rationale }` (`src/server/src/llm/analyze/schema.ts:58` to `src/server/src/llm/analyze/schema.ts:65`).
- Exact count contract: `minItems=maxItems=nodeCount` (`src/server/src/llm/analyze/schema.ts:50`, `src/server/src/llm/analyze/schema.ts:51`).

### Validation and retries

- Backend validates structured output (`src/server/src/routes/llmAnalyzeRoute.ts:523`).
- Openrouter branch retries once with validation errors fed back into prompt (`src/server/src/llm/analyze/openrouterAnalyze.ts:80` to `src/server/src/llm/analyze/openrouterAnalyze.ts:90`).
- Invalid structured output returns `structured_output_invalid` (`src/server/src/routes/llmAnalyzeRoute.ts:535`).

### Frontend post-parse checks

- Frontend semantic assert also enforces exact count and link rules (`src/ai/paperAnalyzer.ts:164`).
- On failure, throws `analysis failed` and surfaces mapped user message (`src/ai/paperAnalyzer.ts:513`, `src/document/nodeBinding.ts:21`).

## 6. Node/Edge Model + Example Produced Today

### Core graph models

- Topology node: `NodeSpec { id, label?, meta? }` (`src/graph/topologyTypes.ts:33`).
- Directed edge: `DirectedLink { from, to, kind?, weight?, meta? }` (`src/graph/topologyTypes.ts:20`).
- Physics spring (derived): `SpringEdge { a, b, restLen, stiffness, compliance?, contributors? }` (`src/graph/topologyTypes.ts:63`).
- Runtime dot: `PhysicsNode` includes display label, role, and analyzer metadata (`src/physics/types.ts:6`, `src/physics/types.ts:60`).
- Runtime physics link: `PhysicsLink { source, target, length?, strength? ... }` (`src/physics/types.ts:101`).

### Analyzer/binder output model

- Analyzer output to binder: `AnalysisResult { paperTitle?, points[], links[] }` (`src/ai/paperAnalyzer.ts:30`).
- Binder writes `node.meta.sourceTitle/sourceSummary` and topology links (`src/document/nodeBinding.ts:96`, `src/document/nodeBinding.ts:118`).
- Saved record persists `topology`, `analysisMeta`, `preview` counts (`src/store/savedInterfacesStore.ts:20`).

### Example object shape (actual current format)

```json
{
  "paper_title": "Development of a happiness measurement scale ...",
  "main_points": [
    { "index": 0, "title": "Mengukur bahagia sebagai akhlak", "explanation": "..." },
    { "index": 1, "title": "Menggugat sekularisme psikologi positif", "explanation": "..." },
    { "index": 2, "title": "Psikometri Rasch sebagai legitimasi", "explanation": "..." },
    { "index": 3, "title": "Aksioma universalitas dan risiko reduksi", "explanation": "..." }
  ],
  "links": [
    { "from_index": 1, "to_index": 0, "type": "challenges", "weight": 0.78, "rationale": "..." },
    { "from_index": 0, "to_index": 2, "type": "operationalizes", "weight": 0.86, "rationale": "..." }
  ]
}
```

Reference sample persisted today: `src/samples/sampleGraphPreview.export.json:18`.

## 7. Caps/Guards/Toggles (What The Model Sees)

### Frontend input shaping

- Optional analyzer truncation policy:
  - Toggle: `ENABLE_ANALYZE_INPUT_TRUNCATION = false` (`src/config/analyzeInputPolicy.ts:6`)
  - Cap value: `ANALYZE_INPUT_MAX_CHARS = 6000` (`src/config/analyzeInputPolicy.ts:7`)
  - Applied in analyzer path: `applyAnalyzeInputPolicy` (`src/ai/paperAnalyzer.ts:361`)
- If enabled, hard slice `text.slice(0, maxChars)` (`src/ai/analyzeInputPolicy.ts:29`).

### Backend request guards

- JSON body limit for analyze route via global parser: `2mb` (`src/server/src/llm/limits.ts:2`, `src/server/src/server/bootstrap.ts:54`).
- Analyze text max: `paperAnalyzeTextMax = 80000` chars (`src/server/src/llm/limits.ts:3`, `src/server/src/llm/validate.ts:76`).
- Analyze nodeCount range: `2..12` (`src/server/src/llm/limits.ts:4`, `src/server/src/llm/limits.ts:5`, `src/server/src/llm/validate.ts:83`).

### Runtime/provider toggles

- Dev direct OpenAI path (bypasses backend analyze route) if `DEV` and `VITE_OPENAI_API_KEY` present (`src/ai/paperAnalyzer.ts:215`).
- Backend provider switch:
  - Openrouter allowed only by env allowlist (`src/server/src/server/envConfig.ts:45` to `src/server/src/server/envConfig.ts:56`)
  - Otherwise forced OpenAI in analyze route (`src/server/src/routes/llmAnalyzeRoute.ts:284` to `src/server/src/routes/llmAnalyzeRoute.ts:287`)
- Beta caps/free toggles gate requests but do not reshape prompt text:
  - frontend: `VITE_BETA_CAPS_MODE` (`src/config/betaCaps.ts:1`)
  - backend: `BETA_CAPS_MODE`, `BETA_FREE_MODE` (`src/server/src/server/envConfig.ts:73`, `src/server/src/server/envConfig.ts:74`)

### Token budgeting

- Token accounting and pricing are tracked (`src/server/src/routes/llmAnalyzeRoute.ts:305`, `src/server/src/llm/usage/usageTracker.ts:155`).
- No explicit token-based truncation of analyze input prompt text is applied in the analyze route.

### Chunking

- No chunking/splitting of analysis document text before analyze prompt in current pipeline.
- File parsers extract full text blobs (`src/document/parsers/pdfParser.ts:52`, `src/document/parsers/docxParser.ts:29`, `src/document/parsers/textParser.ts:20`).

## 8. UI Assumptions (Fixed Count/Layout)

- Runtime default shape is fixed controlled graph when count is `4` (`src/playground/GraphPhysicsPlaygroundShell.tsx:753` to `src/playground/GraphPhysicsPlaygroundShell.tsx:761`).
- Default spawn always runs `spawnGraph(4, 1337)` on init unless restore path blocks it (`src/playground/GraphPhysicsPlaygroundShell.tsx:948`, `src/playground/GraphPhysicsPlaygroundShell.tsx:955`).
- Analyzer binds to existing dots; it does not add/remove dots (`src/document/nodeBinding.ts:66`, `src/document/nodeBinding.ts:130`).
- Prompt preview is hard-mounted in a fixed `200px` container (`src/components/PromptCard.tsx:335`).
- Preview content currently comes from static sample export with fixed topology payload (`src/components/SampleGraphPreview.tsx:265`, `src/components/SampleGraphPreview.tsx:454`, `src/samples/sampleGraphPreview.export.json:18`).
- Restore fallback layout uses circle placement for saved records with missing layout (`src/playground/GraphPhysicsPlaygroundShell.tsx:1008`, `src/playground/GraphPhysicsPlaygroundShell.tsx:1033`).

## 9. Pivot Points (Ranked By Safety/Impact)

1. Prompt role guide abstraction (safe, high impact)
- File: `src/server/src/llm/analyze/prompt.ts:23`
- Replace fixed `BASE_LENSES` slot guide with dynamic skeleton policies while preserving JSON contract.

2. Schema evolution from fixed array to variable skeleton primitives (medium safety, very high impact)
- File: `src/server/src/llm/analyze/schema.ts:33`
- Move from exact indexed points to flexible skeleton nodes/relations schema.

3. Binder decoupling from pre-existing dot count (medium safety, very high impact)
- File: `src/document/nodeBinding.ts:68`
- Stop forcing analyzer output to `orderedNodes.length`; create topology from model output first, then spawn dots from topology.

4. Graph default spawn policy seam (safe, high impact)
- File: `src/playground/GraphPhysicsPlaygroundShell.tsx:937`
- Replace fixed `spawnGraph(4, 1337)` with policy controlled by pending analysis mode.

5. Pending analysis to topology build seam (medium safety, high impact)
- File: `src/playground/GraphPhysicsPlaygroundShell.tsx:1196`
- Introduce dedicated analyzer->topology adapter before mutation.

6. Saved interface model upgrade path (medium safety, medium impact)
- File: `src/store/savedInterfacesStore.ts:20`
- Add versioned record shape for skeleton-specific metadata without breaking existing restore.

7. Topology mutation seam is already correct and should stay the mutation gateway (safe, foundational)
- File: `src/graph/topologyControl.ts:203` and `src/graph/topologyControl.ts:677`
- Keep all structural writes through `setTopology`/`patchTopology`.

8. Preview sample source should not dictate production structure (safe, medium impact)
- File: `src/components/SampleGraphPreview.tsx:265`
- Keep preview deterministic, but isolate from analyzer architecture assumptions.

9. Frontend fallback default `nodeCount ?? 5` cleanup (safe, low-medium impact)
- File: `src/ai/paperAnalyzer.ts:357`
- Remove stale 5 fallback once binder no longer count-coupled.

10. Validation strictness staging (medium safety, medium impact)
- File: `src/server/src/llm/analyze/schema.ts:98`
- Relax/rewrite checks in phases to avoid hard break during transition.

## 10. Risks + Quick Verification Plan

### Risks

- Breaking restore compatibility for existing saved sessions (`src/store/savedInterfacesStore.ts:117`).
- UI regressions if graph runtime still assumes pre-spawned dots before analysis (`src/playground/GraphPhysicsPlaygroundShell.tsx:1159`).
- Cost/caps regressions if submitted word accounting diverges from new payload logic (`src/server/src/routes/llmAnalyzeRoute.ts:230`).
- Structured output failures if schema and prompt shift out of sync (`src/server/src/routes/llmAnalyzeRoute.ts:523`).
- Preview lease/runtime side effects if analyzer flow is accidentally tied to preview path (`src/components/SampleGraphPreview.tsx:390`).

### Quick verification steps

1. Text prompt path:
- Submit text from prompt screen and verify pending flow, successful analysis, and topology mutation logs.

2. File upload path:
- Submit PDF/TXT and verify parse->analyze->bind chain; confirm no stale-doc discard false positives.

3. Structured output failure path:
- Force invalid JSON from provider mock and confirm `structured_output_invalid` handling remains stable.

4. Saved restore path:
- Save, reload, restore interface; verify topology/layout/camera/analysisMeta parity and no write-side effects during restore.

5. Preview isolation:
- Open prompt preview and confirm it still loads static sample without invoking analyzer path.

6. Contract suite:
- Run `npm run test:contracts` in `src/server`.

7. Build checks:
- Run root `npm run build` and server `npm run build`.

## Notes

- Optional analyzer debug dump harness was not added in this run to keep forensic diff minimal and behavior unchanged.
- All findings are based on current repository state on 2026-02-21.
