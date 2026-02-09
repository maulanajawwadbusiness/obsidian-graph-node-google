# Report: Filedrop to Analyzer 6-Step Work Summary
Date: 2026-02-09
Scope: Summary of the first six implementation steps completed for EnterPrompt file-drop to graph analysis flow.

## Step 1
Goal:
- Make EnterPrompt able to submit file when text is empty.

Changes:
- `src/screens/EnterPrompt.tsx`
  - Added prop: `onSubmitPromptFile?: (file: File) => void`
  - Submit policy:
    - text exists: submit text (unchanged)
    - text empty + file exists: submit first file, then enter graph
    - no text and no file: no-op

Outcome:
- EnterPrompt can hand off file payload intent without parsing in EnterPrompt.

## Step 2
Goal:
- Extend AppShell pending payload to support file payload.

Changes:
- `src/screens/AppShell.tsx`
  - Extended pending union with:
    - `{ kind: 'file'; file: File; createdAt: number }`
  - Passed `onSubmitPromptFile` to EnterPrompt
  - Set pending payload for file submit

Outcome:
- AppShell can now carry file pending payload into graph screen.

## Step 3
Goal:
- Add graph consume branch for `kind: 'file'`.

Changes:
- `src/playground/GraphPhysicsPlayground.tsx`
  - Extended pending payload type with file variant
  - Added file branch in existing pending-consume effect
  - Kept one-shot guard and pre-clear pending order
  - Parsed file via `documentContext.parseFile(file)`
  - Ran analysis via `applyAnalysisToNodes(...)` when parsed text exists
  - Reused existing loading and AI error surface

Outcome:
- Graph can consume file pending payload and run parse -> analyze path.

## Step 4
Goal:
- Align EnterPrompt extension gate with parser support.

Changes:
- `src/screens/EnterPrompt.tsx`
  - Added `.markdown` to accepted extension list

Outcome:
- EnterPrompt now accepts both `.md` and `.markdown` like parser support.

## Step 5
Goal:
- Enforce single-file-only attachment in EnterPrompt.

Changes:
- `src/screens/EnterPrompt.tsx`
  - Drop policy changed to last-file-wins
  - Valid dropped file replaces current attachment
  - Invalid dropped file keeps current attachment and shows existing unsupported overlay

Outcome:
- Deterministic single-file behavior with replace-on-new-drop semantics.

## Step 6
Goal:
- Normalize file-branch error mapping using existing AI error surface only.

Changes:
- `src/playground/GraphPhysicsPlayground.tsx`
  - Parse failure:
    - `Could not parse file. Please try another file.`
  - Empty text extraction:
    - `Could not extract text from file (scanned PDF or empty).`
  - Analyze failure mapping:
    - auth-like: `You are not logged in. Please log in and try again.`
    - network-like: existing network message
    - fallback: `Analysis failed. Please try again.`
  - Added minimal logs:
    - `[graph] pending_file_parse_failed ...`
    - `[graph] pending_file_empty_text ...`
    - `[graph] pending_file_analyze_failed ...`

Outcome:
- Failure behavior is calm, consistent, and stays inside existing LoadingScreen/AI error UX.

## Verification Summary
- Build was run after each step block and passed:
  - `npm run build`
- No backend route changes.
- No new UI panel/toast system introduced.
