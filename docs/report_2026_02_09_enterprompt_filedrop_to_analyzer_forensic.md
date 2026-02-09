# Forensic Scan Report: EnterPrompt File Drop to Analyzer Pipeline
Date: 2026-02-09
Scope: Identify everything needed to make EnterPrompt drag-drop document analysis run end to end (parse text, call analyzer, build node map), without code changes yet.

## 1) Executive Summary
Current state:
- EnterPrompt has screen-level drag-drop UI and file chips (`src/screens/EnterPrompt.tsx`, `src/components/PromptCard.tsx`).
- The real parse and analysis pipeline exists, but only in graph runtime (`src/playground/GraphPhysicsPlayground.tsx` + `src/store/documentStore.tsx` + `src/document/nodeBinding.ts`).
- EnterPrompt currently does not hand dropped files to graph analyzer flow.
- AppShell pending handoff supports text only (`kind: 'text'`), not files (`src/screens/AppShell.tsx`).

Main implementation seam:
- Reuse existing parser and analyzer by handing dropped File objects from EnterPrompt to GraphPhysicsPlayground via pending payload, then consume in graph and run existing flow.

## 2) What Already Works (Ground Truth)

### 2.1 EnterPrompt drag-drop UI
- Supported extension filter: `.pdf`, `.docx`, `.md`, `.txt` in `src/screens/EnterPrompt.tsx`.
- Dropped files are stored in local `attachedFiles` state and rendered as chips in `src/components/PromptCard.tsx`.
- No parse call is made from EnterPrompt.
- No analyzer call is made from EnterPrompt.
- Submit path only sends trimmed text and enters graph.

### 2.2 Existing parse pipeline (already implemented elsewhere)
- `DocumentProvider.parseFile(file)` uses worker client in `src/store/documentStore.tsx`.
- Worker dispatch path: `src/document/workerClient.ts` -> `src/document/documentWorker.ts`.
- Parsers:
  - text/md: `src/document/parsers/textParser.ts`
  - docx: `src/document/parsers/docxParser.ts`
  - pdf: `src/document/parsers/pdfParser.ts`

### 2.3 Existing analysis + map build pipeline (already implemented)
- `applyAnalysisToNodes(...)` in `src/document/nodeBinding.ts`:
  - calls `analyzeDocument` in `src/ai/paperAnalyzer.ts`
  - maps points/links to live dots
  - mutates topology via required seam `setTopology(...)`
  - derives springs and rewires physics links
  - resets engine lifecycle
- This is the exact pipeline we should reuse for EnterPrompt file-drop flow.

## 3) Why EnterPrompt File Drop Does Not Run Analysis Today

1. Provider boundary
- `DocumentProvider` is mounted inside `GraphPhysicsPlayground` only.
- EnterPrompt cannot call `useDocument()` directly.
- Therefore EnterPrompt cannot call `parseFile()` or set `aiActivity`.

2. Handoff type gap
- AppShell pending payload type is only:
  - `{ kind: 'text'; text; createdAt } | null`
- No `kind: 'file'` or `kind: 'files'`.

3. Submit behavior gap
- EnterPrompt submit requires non-empty text.
- If user only drops file(s), there is no path to submit analysis from those files.

## 4) Where To Implement (Exact Code Locations)

1. `src/screens/EnterPrompt.tsx`
- Source of dropped files and prompt submit behavior.
- Must hand file payload upward (same as current text handoff).

2. `src/screens/AppShell.tsx`
- Expand pending analysis payload union (text + file/file list).
- Pass expanded payload into graph.

3. `src/playground/GraphPhysicsPlayground.tsx`
- Extend pending payload consume effect:
  - branch on `kind: 'text'` (existing)
  - add `kind: 'file'` or `kind: 'files'` (new)
- In file branch: call `documentContext.parseFile(file)` then existing `applyAnalysisToNodes(...)`.

4. Optional UX sync file
- `src/components/PromptCard.tsx`
- If required, adjust send button behavior copy/disabled state for file-only submit.

## 5) Important System Contracts To Keep

1. Topology mutation seam (non-negotiable)
- All topology changes must stay in `setTopology()` / `patchTopology()`.
- Already respected by `applyAnalysisToNodes`. Do not bypass.

2. Analysis truth path
- Keep using `applyAnalysisToNodes`.
- Do not create a parallel map build path.

3. Auth + balance behavior
- Analyzer auth and balance gates are inside `paperAnalyzer.ts`.
- In dev direct mode (`import.meta.env.DEV` + `VITE_OPENAI_API_KEY`), frontend direct analyze path may bypass backend auth gate.
- Non-dev/no-key still uses backend `/api/llm/paper-analyze`.

4. Overlay/loading behavior
- Graph uses loading short-circuit while `aiActivity` or `aiErrorMessage`.
- File consume must integrate with existing `setAIActivity`/`setAIError` callbacks.

## 6) Conflict and Failure Risks (Edge Cases)

### A. Input and payload edge cases
1. File-only drop, empty text
- Current submit guard blocks run.
- Must allow run when attached files exist.

2. Multiple dropped files
- EnterPrompt allows multiple chips.
- Graph parse flow currently handles one file at a time in its direct drop handler.
- Need explicit policy: first file only vs sequential processing.

3. Duplicate/stale consumption
- Graph uses one-shot `hasConsumedPendingRef`.
- New file payload logic must not cause double runs in StrictMode.

### B. Type/validation mismatches
4. Extension gate mismatch
- EnterPrompt accepts `.md` but not `.markdown`.
- Parser accepts `.markdown`.
- EnterPrompt may reject valid parser-supported text files.

5. MIME fallback mismatch
- Parser can parse `text/*` by MIME.
- EnterPrompt currently uses extension-only filter and may reject MIME-valid files without known extension.

### C. Parser/analyzer behavior edge cases
6. Parsed text empty
- Scanned PDFs can return empty text with warning.
- Analyzer call with empty text will fail (server validator requires non-empty text).
- Need explicit user-facing parse-empty handling.

7. Huge documents
- Parser can extract large text, but analyzer truncates to first 6000 chars.
- Result may not reflect full file; expected behavior should be documented.

8. Worker or PDF worker failures
- PDF parser depends on pdfjs worker URL.
- Network/worker failure returns parse error; EnterPrompt currently has only unsupported-extension overlay, not parse failure overlay.

### D. Runtime interaction edge cases
9. Pending + manual drop race
- User can drop again on graph canvas while pending consume runs.
- Existing stale-doc protection in graph pending path uses mutable doc id ref; keep this pattern for file path too.

10. Viewer source consistency
- HalfLeftWindow prioritizes `rawFile` over `activeDocument`.
- EnterPrompt file handoff may not set `rawFile` state unless explicitly wired; viewer can still render from `activeDocument.text`, but raw file rendering parity may differ.

## 7) Recommended Implementation Shape (Minimal Diff)

1. Keep parser execution in graph, not EnterPrompt.
Why:
- `parseFile` lives in DocumentProvider scope.
- Avoid lifting provider to AppShell.
- Reuse existing graph-side AI/loading/title wiring.

2. Extend pending payload union in AppShell:
- Add `kind: 'file'` with `file: File` and timestamp.
- Optionally add `kind: 'files'` if sequential processing is desired now.

3. EnterPrompt submit policy:
- If trimmed text exists, keep text path.
- Else if attachedFiles length > 0, submit file payload.
- Else no-op.

4. Graph consume branch:
- For `kind: 'file'`:
  - call `documentContext.parseFile(file)`
  - on success call `applyFirstWordsToNodes` then `applyAnalysisToNodes`
  - on parse failure set AI error message path clearly
  - clear pending payload at consume start to prevent replay

5. Keep all map mutations through existing nodeBinding pipeline.

## 8) File and System Map (for implementer)

Core files:
- `src/screens/EnterPrompt.tsx`
- `src/components/PromptCard.tsx`
- `src/screens/AppShell.tsx`
- `src/playground/GraphPhysicsPlayground.tsx`
- `src/store/documentStore.tsx`
- `src/document/nodeBinding.ts`
- `src/ai/paperAnalyzer.ts`
- `src/document/documentWorker.ts`
- `src/document/parsers/*.ts`

Reference docs:
- `docs/file-drop-feature-report.md`
- `docs/system.md`
- `docs/repo_xray.md`
- `docs/report_2026_02_09_enterprompt_text_to_analyzer_forensic.md`

## 9) Acceptance Conditions (for later implementation verification)
1. Drop supported file on EnterPrompt.
2. Click send (with empty text allowed when file exists), app transitions to graph.
3. Graph runs parse then analysis automatically.
4. Dot labels and directed links are applied, topology mutation log shows applied setTopology.
5. Visible map appears (render loop running).
6. Unsupported extension still shows error overlay.
7. Parse failure and empty-text extraction produce explicit user-visible failure state.
