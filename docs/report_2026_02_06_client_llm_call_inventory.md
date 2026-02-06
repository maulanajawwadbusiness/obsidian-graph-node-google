# Client-Side LLM Call Inventory (2026-02-06)

Scope: Scan only. No code changes. Evidence with file paths and line ranges.

Goal: Identify exact client-side LLM calls and their input/output shapes so we can replace them.

## Summary: Exact 3 LLM Calls to Replace
1) paperAnalyzer -> structured JSON response (non-streaming)
2) fullChatAi -> streaming text response
3) prefillSuggestion -> single text response (non-streaming)

All three go through createLLMClient -> OpenAIClient, which uses OpenAI Responses API over fetch. OpenRouter client is stubbed and does not send requests.

## A) paperAnalyzer (structured output)

Where it sends requests
- Module: src/ai/paperAnalyzer.ts
- Call site: analyzeDocument -> client.generateStructured
- Evidence: src/ai/paperAnalyzer.ts:42-67; 157-167.

Input payload shape (prompt + schema)
- Prompt is a long system instruction string + document excerpt. Evidence: src/ai/paperAnalyzer.ts:62-112.
- Schema passed to generateStructured defines JSON with:
  - paper_title: string
  - main_points: array of { index: integer, title: string, explanation: string }
  - links: array of { from_index, to_index, type, weight, rationale }
  Evidence: src/ai/paperAnalyzer.ts:118-155.
- Model used: AI_MODELS.ANALYZER (value defined elsewhere) and mode 'openai'. Evidence: src/ai/paperAnalyzer.ts:56-60; 162-166.

Transport details (OpenAI Responses API)
- OpenAIClient.generateStructured uses POST https://api.openai.com/v1/responses.
- Request body fields:
  - model
  - input: [{ role: 'user', content: prompt }]
  - temperature (omitted for gpt-5 models)
  - text.format = { type: 'json_schema', name, schema, strict: true }
  - store: false
  Evidence: src/ai/openaiClient.ts:260-291.

Output expected by UI
- Non-streaming JSON parsed into AnalysisResult:
  - points mapped from main_points
  - links mapped from links
  Evidence: src/ai/paperAnalyzer.ts:171-186.

OpenRouter usage
- createLLMClient can create OpenRouterClient, but OpenRouter is stubbed and does not perform network calls. Evidence: src/ai/index.ts:15-29; src/ai/openrouterClient.ts:13-40.

## B) fullChatAi (streaming text)

Where it sends requests
- Module: src/fullchat/fullChatAi.ts
- Call site: realResponseGenerator -> client.generateTextStream
- Evidence: src/fullchat/fullChatAi.ts:35-99.

Input payload shape (prompt)
- Builds a system prompt with context (nodeLabel, documentTitle, documentText, recentHistory) and appends USER PROMPT.
- Prompt composition: buildSystemPrompt + userPrompt.
  Evidence: src/fullchat/fullChatAi.ts:73-75; 158-185.
- Model used: AI_MODELS.CHAT via createLLMClient in mode 'openai'. Evidence: src/fullchat/fullChatAi.ts:24-27; 66-71; 85-87.

Transport details (OpenAI Responses API, streaming)
- OpenAIClient.generateTextStream uses POST https://api.openai.com/v1/responses with stream: true.
- Request body fields:
  - model
  - input: [{ role: 'user', content: prompt }]
  - temperature (omitted for gpt-5 models)
  - max_output_tokens (from opts.maxCompletionTokens)
  - stream: true
  - store: false
  Evidence: src/ai/openaiClient.ts:18-49.

Output expected by UI
- Streaming text chunks (delta frames). UI consumes AsyncGenerator chunks and appends to the message.
  Evidence: src/ai/openaiClient.ts:83-111; src/fullchat/fullChatAi.ts:89-99.

OpenRouter usage
- OpenRouterClient.generateTextStream is stubbed and yields a fixed string. Evidence: src/ai/openrouterClient.ts:25-32.

## C) prefillSuggestion (single text)

Where it sends requests
- Module: src/fullchat/prefillSuggestion.ts
- Call site: refinePromptWithReal -> client.generateText
- Evidence: src/fullchat/prefillSuggestion.ts:85-122.

Input payload shape (prompt)
- System prompt for one-line prompt generation + CONTEXT built by buildRefinePacket.
- buildRefinePacket includes nodeLabel, optional content summary, and recent mini chat history.
  Evidence: src/fullchat/prefillSuggestion.ts:101-121; 149-170.
- Model used: AI_MODELS.PREFILL via createLLMClient in mode 'openai'. Evidence: src/fullchat/prefillSuggestion.ts:93-118.

Transport details (OpenAI Responses API, non-streaming)
- OpenAIClient.generateText uses POST https://api.openai.com/v1/responses.
- Request body fields:
  - model
  - input: [{ role: 'user', content: prompt }]
  - temperature (omitted for gpt-5 models)
  - max_output_tokens (from opts.maxCompletionTokens)
  - store: false
  Evidence: src/ai/openaiClient.ts:170-195.

Output expected by UI
- Single string, sanitized to one line and max 160 chars. Evidence: src/fullchat/prefillSuggestion.ts:123-193.

OpenRouter usage
- OpenRouterClient.generateText is stubbed and returns a fixed string. Evidence: src/ai/openrouterClient.ts:17-23.

## Conclusion
- Exact 3 client-side LLM calls that must be replaced:
  1) paperAnalyzer -> generateStructured (OpenAI Responses API, JSON schema output)
  2) fullChatAi -> generateTextStream (OpenAI Responses API, streaming text)
  3) prefillSuggestion -> generateText (OpenAI Responses API, single text)
- All three are currently client-side and use fetch directly to OpenAI via OpenAIClient.
- OpenRouter is present but stubbed; it does not perform network calls.

End of report.
