# Report: Step 5 - Frontend Calls Server LLM Endpoints

Date: 2026-02-06
Scope: Switch client-side LLM calls to backend endpoints. No endpoint changes here.

## Summary
Updated the three client call sites (paper analyzer, full chat streaming, prefill) to call server endpoints instead of OpenAI directly. Frontend no longer depends on client-side OpenAI API keys in these paths. Streaming now reads raw text chunks from /api/llm/chat and yields them unchanged to the UI.

## Changed Files
- src/ai/paperAnalyzer.ts
- src/fullchat/fullChatAi.ts
- src/fullchat/prefillSuggestion.ts

## Behavior Changes

### Paper Analyzer
- Calls POST /api/llm/paper-analyze with { text, nodeCount, model } and credentials include.
- Maps server response { ok, request_id, json } into the same AnalysisResult shape as before.
- On 401/403, falls back to deterministic placeholders and logs a login warning.

### Full Chat Streaming
- Replaces OpenAI client streaming with POST /api/llm/chat.
- Reads response.body as ReadableStream and yields raw text chunks to the same AsyncGenerator interface used by the UI.
- On 401/403, yields a short "please log in" message and ends.

### Prefill
- Calls POST /api/llm/prefill with { model, nodeLabel, miniChatMessages, content }.
- Accepts { ok, request_id, prompt | text } and returns the same string result as before.
- On 401/403, falls back to mock refinement.

## Credentials
- All new fetches use credentials: "include" for cookie auth.

## Manual Test Plan
1) Logged-in: analyzer -> graph points appear.
2) Logged-in: chat -> streaming responses appear and update incrementally.
3) Logged-in: prefill -> suggestion appears.
4) Logged-out: endpoints return 401 and UI shows fallback or login prompt.

## Notes
- src/ai/openaiClient.ts remains in repo but is no longer used by these three call sites.
- No secrets added to repo or logs.

End of report.
