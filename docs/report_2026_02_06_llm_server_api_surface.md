# Server API Surface for LLM (Minimal Endpoints) - 2026-02-06

Scope: Scan-informed plan. No code changes. This report defines server endpoints that mirror current client needs and return the exact shapes the frontend expects.

## Summary: Minimal Endpoints
- POST /api/llm/paper-analyze
- POST /api/llm/chat
- POST /api/llm/prefill

All endpoints must require auth cookie session (same pattern as existing /api routes), validate inputs, call the model server-side, and return the exact shapes the current UI expects.

Evidence for current client expectations and payloads is included below.

## Common Requirements (All Endpoints)
- Auth: must use cookie-based session validation (same as requireAuth in server index). Evidence: src/server/src/index.ts:155-182.
- Input validation: minimal guards are sufficient (string checks, length caps), but must ensure required fields exist before calling model.
- Response shapes must match current client-side contract exactly to avoid UI breakage.
- Do NOT log or return secrets.

## 1) POST /api/llm/paper-analyze

### Purpose
Replaces client-side paperAnalyzer structured generation with server-side LLM call.

### Current client call (to replace)
- Function: analyzeDocument -> client.generateStructured
- Input: long prompt + JSON schema
- Output: AnalysisResult derived from JSON schema response
Evidence: src/ai/paperAnalyzer.ts:42-67; 118-186.

### Required request body (server endpoint)
Suggested minimal shape (mirrors what paperAnalyzer currently provides):
```
{
  text: string,          // document text
  nodeCount?: number     // optional; defaults like current client (min 2, max 12)
}
```
Evidence for nodeCount logic: src/ai/paperAnalyzer.ts:42-45.

### Validation (minimal)
- text: required string, non-empty
- nodeCount: optional number; clamp to [2, 12]
Evidence: src/ai/paperAnalyzer.ts:42-45.

### Server-side model call inputs
- Prompt: same system prompt and document excerpt logic as current paperAnalyzer.
Evidence: src/ai/paperAnalyzer.ts:62-112.
- Schema: same JSON schema as current client.
Evidence: src/ai/paperAnalyzer.ts:118-155.
- Model: AI_MODELS.ANALYZER (value defined in config). Evidence: src/ai/paperAnalyzer.ts:162-166.

### Expected response shape (exact)
Return the same structure the client currently expects from analyzeDocument:
```
{
  paperTitle?: string,
  points: Array<{ index: number; title: string; summary: string }>,
  links: Array<{ fromIndex: number; toIndex: number; type: string; weight: number; rationale: string }>
}
```
Evidence for mapping: src/ai/paperAnalyzer.ts:171-186.

### Notes
- Current client truncates text to first 6000 chars before prompt. Replicate on server to keep behavior consistent.
Evidence: src/ai/paperAnalyzer.ts:46-48.

## 2) POST /api/llm/chat

### Purpose
Replaces fullChatAi streaming generation with server-side LLM call.

### Current client call (to replace)
- Function: generateResponseAsync -> realResponseGenerator -> client.generateTextStream
- Input: system prompt built from context + user prompt
- Output: streaming text chunks
Evidence: src/fullchat/fullChatAi.ts:35-99; 158-185.

### Required request body (server endpoint)
Suggested minimal shape (mirrors current buildSystemPrompt + user prompt):
```
{
  userPrompt: string,
  context: {
    nodeLabel?: string | null,
    documentText?: string | null,
    documentTitle?: string | null,
    recentHistory?: Array<{ role: 'user' | 'ai'; text: string }>
  }
}
```
Evidence for context fields: src/fullchat/fullChatAi.ts:158-185; AiContext in src/fullchat/fullChatTypes.ts (not expanded here).

### Validation (minimal)
- userPrompt: required string, non-empty
- context: required object (can be empty object)
- recentHistory: optional array of { role, text }

### Server-side model call inputs
- System prompt: same buildSystemPrompt content.
Evidence: src/fullchat/fullChatAi.ts:158-185.
- Full prompt concatenation: `${systemPrompt}\n\nUSER PROMPT:\n${userPrompt}`.
Evidence: src/fullchat/fullChatAi.ts:73-75.
- Model: AI_MODELS.CHAT. Evidence: src/fullchat/fullChatAi.ts:24-27; 66-71.

### Expected response shape (exact)
The frontend expects streaming chunks from AsyncGenerator and appends them to the message text. Evidence: src/fullchat/fullChatAi.ts:89-99.

Recommended server response shape:
- Use text/event-stream for streaming deltas, with each event carrying a text chunk.
- If not streaming (fallback), return JSON with a single text field, but then client must adapt.

For minimal change to the UI, keep streaming semantics.

### Note
Full chat UI is currently disabled at the store level (feature flag), but the API should still match the existing expectations to avoid future refactors.
Evidence: src/fullchat/FullChatStore.tsx:16-52; 243-252.

## 3) POST /api/llm/prefill

### Purpose
Replaces prefillSuggestion refinePromptWithReal with server-side LLM call.

### Current client call (to replace)
- Function: refinePromptWithReal -> client.generateText
- Input: system prompt + buildRefinePacket(context)
- Output: single string
Evidence: src/fullchat/prefillSuggestion.ts:85-133; 149-170.

### Required request body (server endpoint)
Suggested minimal shape (mirrors PrefillContext):
```
{
  nodeLabel: string,
  miniChatMessages?: Array<{ role: 'user' | 'ai'; text: string }>,
  content?: { title: string; summary: string } | null
}
```
Evidence for PrefillContext: src/fullchat/prefillSuggestion.ts:13-18; 149-170.

### Validation (minimal)
- nodeLabel: required string, non-empty
- miniChatMessages: optional array of { role, text }
- content: optional { title, summary }

### Server-side model call inputs
- System prompt: same as current prefillSuggestion.
Evidence: src/fullchat/prefillSuggestion.ts:101-111.
- Context packet: buildRefinePacket.
Evidence: src/fullchat/prefillSuggestion.ts:149-170.
- Model: AI_MODELS.PREFILL. Evidence: src/fullchat/prefillSuggestion.ts:115-118.

### Expected response shape (exact)
Return a single string (already sanitized to one line and max length on client today). Evidence: src/fullchat/prefillSuggestion.ts:123-193.

Recommended server response JSON:
```
{ prompt: string }
```
Then client can replace local generateText call with server response and still apply sanitizeOutput if needed.

## Auth Requirements (All Endpoints)
- Use same cookie session validation as requireAuth.
Evidence: src/server/src/index.ts:155-182.

## Minimal Guard Rails
- Cap input size (documentText length and recentHistory length) to avoid oversized prompts.
- Ensure output shape matches exactly what current UI expects.

## Appendix: Evidence of Client-Side OpenAI Use
- OpenAI Responses API used in OpenAIClient via fetch, for stream and non-stream requests.
Evidence: src/ai/openaiClient.ts:18-49; 170-195; 260-291.

End of report.
