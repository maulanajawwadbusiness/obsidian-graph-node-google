# Forensic Implementation Plan: EnterPrompt File Drop to Analyzer
Date: 2026-02-09
Scope: Plan-only scandissect to wire EnterPrompt drag-drop files into existing parse -> paperAnalyzer -> node-map truth path, with minimal diffs and no parallel pipeline.

## 0) Executive Read
Current truth:
- EnterPrompt already captures dropped files into `attachedFiles`, but submit only works when text is non-empty.
- Parser and analyzer truth path already exists in graph runtime and must be reused.
- Minimal seam is pending payload extension in AppShell and a new file branch in graph pending-consume effect.

Implementation decision set:
1. Parse in graph only (not EnterPrompt) due to `DocumentProvider` boundary.
2. Pending payload adds `kind: 'file'` and carries one `File`.
3. Multiple files policy: first file only for this step (minimal and deterministic).
4. Extension gate policy: include `.markdown` to align EnterPrompt gate with parser support.
5. Parse-empty handling: set existing AI error surface via `setAIError`, no new UI panels.
6. Viewer parity: set `lastDroppedFile` in file pending branch so viewer can use raw file source.

## A) Current EnterPrompt File-Drop Truth State

### A1. `src/screens/EnterPrompt.tsx`
Confirmed:
- `attachedFiles` state exists in `src/screens/EnterPrompt.tsx:31`.
- Accepted extension gate is `['.pdf', '.docx', '.md', '.txt']` in `src/screens/EnterPrompt.tsx:11`.
- Unsupported-file overlay is controlled by `showUnsupportedError` in `src/screens/EnterPrompt.tsx:33`, toggled in drop handler `src/screens/EnterPrompt.tsx:72`, rendered in `src/screens/EnterPrompt.tsx:144`.
- Current submit is text-only:
  - `handlePromptSubmit` trims and early-returns on empty text in `src/screens/EnterPrompt.tsx:37`.
  - calls `onSubmitPromptText?.(trimmed)` in `src/screens/EnterPrompt.tsx:40`.
  - file-only submit is impossible today.

### A2. `src/components/PromptCard.tsx`
Confirmed:
- File chips render from props `attachedFiles` and `onRemoveFile` in `src/components/PromptCard.tsx:13` and `src/components/PromptCard.tsx:14`.
- Chip render map in `src/components/PromptCard.tsx:82`.
- Send + keyboard submit path:
  - `handleSubmit` trims and submits in `src/components/PromptCard.tsx:47`.
  - Enter submits in `src/components/PromptCard.tsx:61`.
  - Shift+Enter leaves newline behavior (no submit branch).

## B) Early Parser Truth Path (Only Allowed Parser)

### B1. Authoritative parse entrypoint
- `documentContext.parseFile(file)` in `src/store/documentStore.tsx:109`.
- `parseFile` sets parse status and stores `SET_DOCUMENT` on success in `src/store/documentStore.tsx:106` and `src/store/documentStore.tsx:112`.

### B2. Worker path end-to-end
1. `DocumentStore.parseFile` -> `WorkerClient.parseFile` (`src/store/documentStore.tsx:109`).
2. Worker spawn and postMessage in `src/document/workerClient.ts:28` and `src/document/workerClient.ts:87`.
3. Worker parser select in `src/document/documentWorker.ts:41`.
4. Parser modules:
   - text/md: `src/document/parsers/textParser.ts`
   - docx: `src/document/parsers/docxParser.ts`
   - pdf: `src/document/parsers/pdfParser.ts`

### B3. Parse return shape and required fields
`ParsedDocument` in `src/document/types.ts:6` requires:
- `id`, `fileName`, `mimeType`, `sourceType`, `text`, `warnings`, `meta.wordCount`, `meta.charCount`, optional `meta.pages`.

Important parser behavior:
- `TextParser` supports MIME `text/*` and extension `txt/md/markdown` (`src/document/parsers/textParser.ts:10`).
- `PdfParser` can return empty `text` and warning `No text extracted...` (`src/document/parsers/pdfParser.ts:56`).
- Worker returns hard parse error if no parser matched (`src/document/documentWorker.ts:47`).

## C) Minimal Seam: EnterPrompt Drop -> Graph Analyzer

### C1. Pending payload extension in AppShell
Current type is text-only in `src/screens/AppShell.tsx:19`.
Extend to:
- `{ kind: 'text'; text: string; createdAt: number }`
- `{ kind: 'file'; file: File; createdAt: number }`
- `null`

Call sites to update:
- `src/screens/AppShell.tsx:19` (type)
- `src/screens/AppShell.tsx:220` (current set for text)
- `src/playground/GraphPhysicsPlayground.tsx:44` (mirrored payload type)

### C2. EnterPrompt submit policy
Implement in `src/screens/EnterPrompt.tsx`:
1. If trimmed text exists, keep existing text submit path.
2. Else if `attachedFiles.length > 0`, submit first file as file payload.
3. Else no-op.

Why:
- Minimal behavior change.
- Preserves current text workflow.
- Unlocks file-only path without extra UI.

### C3. Graph consume policy
Extend existing pending effect at `src/playground/GraphPhysicsPlayground.tsx:578`:
- Keep `kind='text'` branch unchanged.
- Add `kind='file'` branch:
  1. readiness gates (same as text): not consumed, `aiActivity` false, engine exists, `nodes.size > 0` (`src/playground/GraphPhysicsPlayground.tsx:579` to `:581`).
  2. set one-shot consumed + pre-clear pending via `onPendingAnalysisConsumed()` (`src/playground/GraphPhysicsPlayground.tsx:583`, `:603`).
  3. set `lastDroppedFile(file)` for viewer parity.
  4. call `documentContext.parseFile(file)`.
  5. if parse failed: set AI error surface (`documentContext.setAIError(...)`) and stop.
  6. if parsed text is empty after trim: set AI error surface and stop.
  7. else run existing truth path:
     - optional immediate labels via `applyFirstWordsToNodes`.
     - `applyAnalysisToNodes(engineRef.current, parsed.text, docId, ...)`.

## D) Edge Cases, Conflicts, and Decisions

### D1. Multiple dropped files
Decision: first file only for v1.
Why:
- Graph `handleDrop` already uses first file only (`src/playground/GraphPhysicsPlayground.tsx:380`).
- Minimal diff and deterministic behavior.
- Avoid queue semantics/race complexity in this pass.

StrictMode safety:
- Keep `hasConsumedPendingRef` guard and pre-clear pending before async branch.

### D2. Extension vs MIME mismatch
Conflict:
- EnterPrompt gate is extension-only (`src/screens/EnterPrompt.tsx:11`).
- Parser accepts MIME and also `.markdown` (`src/document/parsers/textParser.ts:10`).

Decision:
- Expand EnterPrompt accepted extension list to include `.markdown`.
- Keep extension gate model otherwise unchanged for this step.

### D3. Empty extraction (scanned PDF)
Conflict:
- Parser can succeed with empty text + warning (`src/document/parsers/pdfParser.ts:56`).
- Analyzer backend rejects empty text (`src/server/src/llm/validate.ts:63`).

Decision:
- Catch before analyzer call in file consume branch.
- Set `aiError` with explicit parse-empty message (existing LoadingScreen error surface, no new panel).

### D4. Huge docs
Confirmed behavior:
- Analyzer truncates to first 6000 chars in `src/ai/paperAnalyzer.ts:263`.

Decision:
- Keep current truncation behavior.
- Document this as expected result for file path as well.

### D5. Viewer parity (`rawFile` vs `activeDocument`)
Confirmed:
- HalfLeftWindow prefers `rawFile` first (`src/playground/components/HalfLeftWindow.tsx:78`) and falls back to `activeDocument.text` (`src/playground/components/HalfLeftWindow.tsx:81`).

Decision:
- Set `lastDroppedFile(file)` in pending file branch to preserve same raw-file viewer behavior as graph drag-drop.

## E) File-Drop -> Map ASCII Flow

```text
EnterPrompt onDrop(files)
  -> attachedFiles[] (UI chips only)
  -> user presses Send
      -> submit policy
         -> text present? pending {kind:text}
         -> else file present? pending {kind:file}
         -> else no-op
  -> AppShell setPendingAnalysis(...), setScreen('graph')
  -> Graph mounts and spawnGraph initializes dots
  -> pending-consume effect readiness gates pass
  -> pre-clear pending + one-shot consume guard
  -> kind=file branch:
       parseFile(file) via DocumentStore -> Worker -> parser
       -> parse fail or empty text: setAIError (existing LoadingScreen)
       -> parse ok: applyFirstWordsToNodes (optional quick label)
       -> applyAnalysisToNodes (truth path)
          -> paperAnalyzer
          -> setTopology
          -> derive springs + physics links
          -> engine rewired
  -> map visible with updated labels/links/title
```

## F) Exact Files To Edit (Minimal Diffs)
1. `src/screens/EnterPrompt.tsx`
- submit policy for text-or-file
- accepted extension list include `.markdown`
- add callback prop for file submit to AppShell

2. `src/screens/AppShell.tsx`
- pending payload union type extension
- pass new file submit callback into EnterPrompt
- set pending payload for `kind:'file'`

3. `src/playground/GraphPhysicsPlayground.tsx`
- pending payload union type extension
- add `kind:'file'` consume branch
- parse-empty handling + parse-fail mapping to `setAIError`
- `setLastDroppedFile(file)` in file consume branch

Optional only if type sharing is desired (not required for minimal diff):
4. shared type file for pending payload (currently duplicated types in AppShell and Graph).

## G) Readiness Gates for Graph Consume
Use same gate set as existing text path:
- payload exists
- not already consumed (`hasConsumedPendingRef`)
- `documentContext.state.aiActivity` is false
- engine exists and `engineRef.current.nodes.size > 0`
- pre-clear pending before async branch begins

## H) Error Mapping Strategy (No New Panels)
Use existing `aiErrorMessage` -> `LoadingScreen` surface (`src/playground/GraphPhysicsPlayground.tsx:783`):
- Parse fail (`parseFile` returns null): set `setAIError('We could not parse this file, so analysis did not run. Your graph is unchanged.')`
- Parse-empty (`document.text.trim().length === 0`): set `setAIError('We could not extract text from this file, so analysis did not run. Your graph is unchanged.')`
- Analyzer auth/network: keep existing `applyAnalysisToNodes` mapping (`src/document/nodeBinding.ts:160`).

No new toasts, panels, or overlays.

## I) Manual Test Checklist
1. File-only drop (supported `.txt`) + empty text + Send -> graph parses and map builds.
2. Text-only submit (no file) -> existing behavior unchanged.
3. Both text and file present -> text path wins (by policy), behavior unchanged from current text flow.
4. Multi-file drop -> first file only analyzed, no duplicate run.
5. Unsupported extension drop -> existing unsupported overlay still appears.
6. Empty extraction PDF -> existing error surface shows parse-empty message.
7. Parse failure (corrupt file) -> existing error surface shows parse failure message.
8. Auth/network analyzer failure -> existing mapped message unchanged.
9. Viewer check after file pending consume -> raw file rendering works (not text fallback only).

## J) Why This Plan Is Minimal and Safe
- Reuses only existing truth path (`parseFile` + `applyAnalysisToNodes`).
- No new architecture layer, no provider lifting, no new UI system.
- Keeps topology mutation and physics rewiring through existing tested seam.
- Contains scope to three primary files with straightforward branching changes.

## Step 1 Update (Implemented)
- Added new optional EnterPrompt prop: `onSubmitPromptFile?: (file: File) => void` in `src/screens/EnterPrompt.tsx`.
- Updated EnterPrompt submit policy:
  - trimmed text exists: unchanged text submit path (`onSubmitPromptText` then `onEnter`).
  - text empty and `attachedFiles.length > 0`: submit first file via `onSubmitPromptFile(attachedFiles[0])`, then `onEnter`.
  - no text and no file: no-op.
- Unsupported extension overlay behavior remains unchanged.
- Added one calm dev-only debug log on file submit:
  - `[enterprompt] submitted_file name=... size=...`

## Step 2 Update (Implemented)
- Extended `PendingAnalysisPayload` in `src/screens/AppShell.tsx` to include file variant:
  - `{ kind: 'text'; text: string; createdAt: number }`
  - `{ kind: 'file'; file: File; createdAt: number }`
  - `null`
- Wired `onSubmitPromptFile` callback in AppShell -> EnterPrompt:
  - `setPendingAnalysis({ kind: 'file', file, createdAt: Date.now() })`
  - log: `[appshell] pending_analysis_set kind=file name=%s size=%d`
- Kept existing text submit path unchanged.
- Kept graph pass-through unchanged:
  - `pendingAnalysisPayload={pendingAnalysis}`
  - `onPendingAnalysisConsumed={() => setPendingAnalysis(null)}`

## Step 3 Update (Implemented)
- File-branch pending consume code now lives in `src/playground/GraphPhysicsPlayground.tsx` inside the existing pending-analysis `useEffect`.
- Readiness gate used before consume:
  - payload exists
  - one-shot guard not consumed
  - `documentContext.state.aiActivity` is false
  - `engineRef.current` exists and `engineRef.current.nodes.size > 0`
- One-shot + pre-clear mechanism for file branch:
  1. set `hasConsumedPendingRef.current = true`
  2. log `[graph] consuming_pending_analysis kind=file name=... size=...`
  3. call `onPendingAnalysisConsumed()` before any `await`
  4. async parse+analyze
  5. log `[graph] pending_analysis_done ok=true/false`
- File branch behavior:
  - `setLastDroppedFile(file)` for viewer parity
  - parse with `await documentContext.parseFile(file)`
  - empty or missing parsed text -> `setAIError('Could not extract text from file (scanned PDF or empty).')`
  - parse success -> `documentContext.setDocument(parsed)` and `applyAnalysisToNodes(...)` with parsed text/doc id
- Existing loading/error surface is reused (no new toasts or panels).

## Step 4 Update (Implemented)
- Updated EnterPrompt extension gate in `src/screens/EnterPrompt.tsx` to include `.markdown` in `ACCEPTED_EXTENSIONS`.
- This aligns EnterPrompt drop acceptance with parser support (`.md` and `.markdown`).
- Unsupported-extension overlay behavior remains unchanged for files outside the accepted list.

## Step 5 Update (Implemented)
- Enforced single-file-only attachment policy in `src/screens/EnterPrompt.tsx` while keeping `attachedFiles` as `File[]` for minimal diff.
- Drop behavior now uses only the last incoming file (`files[files.length - 1]`):
  - valid extension: replaces current attachment with `[lastFile]`
  - invalid extension: keeps current attachment unchanged and triggers existing unsupported overlay
- Resulting UI chip state remains single-item (or empty) because attachment is always replaced, never appended.
- No new UI panels or toasts were added.

## Step 6 Update (Implemented)
- Updated file-pending branch error mapping in `src/playground/GraphPhysicsPlayground.tsx` (pending consume `useEffect`, file branch near `pending_file_*` logs).
- Parse failure handling:
  - `parseFile` throw or null result now maps to:
    - `setAIError('Could not parse file. Please try another file.')`
  - logs:
    - `[graph] pending_file_parse_failed ...`
  - `setAIActivity(false)` is called to avoid stuck loading state.
- Empty-text handling:
  - when parsed text is missing/trim-empty, maps to:
    - `setAIError('Could not extract text from file (scanned PDF or empty).')`
  - log:
    - `[graph] pending_file_empty_text`
  - graph/topology remains unchanged.
- Analyze failure handling (`applyAnalysisToNodes` catch):
  - auth-like (`401/403/unauthorized/forbidden/log in`) ->
    - `setAIError('You are not logged in. Please log in and try again.')`
  - network-like (`failed to fetch/network/timeout`) ->
    - `setAIError('We could not reach the server, so analysis did not run. Your graph is unchanged.')`
  - fallback ->
    - `setAIError('Analysis failed. Please try again.')`
  - log:
    - `[graph] pending_file_analyze_failed ...`
- One-shot no-retry behavior remains enforced by existing guard+pre-clear order:
  - guard set true before async
  - `onPendingAnalysisConsumed()` before any await
  - pending payload is consumed once even on failure.

## Step 7 Update (Implemented)
- Fixed file-only send gating in `src/components/PromptCard.tsx` so submit can proceed when text is empty but an attached file exists.
- Added optional prop `canSubmitWithoutText?: boolean` to `PromptCard`.
- Updated submit behavior:
  - text present: unchanged (`onSubmit(trimmed)`)
  - text empty + `canSubmitWithoutText` true: `onSubmit('')`
  - otherwise: no-op
- Wired from EnterPrompt in `src/screens/EnterPrompt.tsx`:
  - `canSubmitWithoutText={attachedFiles.length > 0}`
- Result: with one valid attached file and empty text, Send/Enter now triggers existing EnterPrompt file handoff path.

## Step 8 Update (Implemented)
- Added worker-readiness signal in `src/store/documentStore.tsx`:
  - new context field: `isWorkerReady: boolean`
  - set to `true` after `WorkerClient` initialization in provider mount effect
  - reset to `false` during cleanup
- Updated graph pending consume in `src/playground/GraphPhysicsPlayground.tsx`:
  - file branch now gates on `documentContext.isWorkerReady` before consume
  - pending file payload is not consumed until worker is ready
- This fixes early file parse race (`Worker not initialized`) that could surface as:
  - `Could not parse file. Please try another file.`
- One-shot + pre-clear semantics remain unchanged after readiness gate passes.
