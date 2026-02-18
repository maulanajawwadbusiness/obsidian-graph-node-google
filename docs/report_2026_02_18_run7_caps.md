# Run 7 Caps Report
Date: 2026-02-18
Scope: prompt-time upload word count and fail-closed disable behavior.

## Changes
- Updated `src/screens/EnterPrompt.tsx` to parse attached files at prompt time using worker.

## Worker wiring
- Uses existing `WorkerClient` from `src/document/workerClient.ts`.
- EnterPrompt now creates a worker client when beta caps UI mode is enabled.
- On supported file attach:
  - sets parse status to `pending`
  - parses file in worker
  - reads `parsed.meta.wordCount`
  - stores word count in prompt state
- On parse failure:
  - parse status becomes `error`
  - send is disabled (fail-closed)

## Prompt states added
- `attachedFileWordCount`
- `attachedFileParseStatus` (`idle | pending | ready | error`)
- parse run id guard to avoid stale parse completions updating current state.

## UX behavior
- While parsing upload: info balloon `checking document...` and send disabled.
- If parse fails: error balloon `failed to parse document` and send disabled.
- If parsed word count > 7500: error balloon exact `Document is more than 7500 words` and send disabled.

## submitted_word_count note
- Analyze request already sends `submitted_word_count` from original document text in `paperAnalyzer.ts`.
- This remains consistent with no-truncate counting policy.

## Verification
- repo root: `npm run build` passed.
- `src/server`: `npm run build` passed.
