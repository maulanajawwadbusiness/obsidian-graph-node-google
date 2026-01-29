# AI Wiring Guide (arnvoid)

This document explains how AI calls are wired in this repo, where the client is set up, where parameters live, and how to make reliable, repeatable changes. It is written to be unambiguous and easy to follow under pressure.

## 1) What AI does in this repo (today)
There are two real AI call sites:

1) Prefill suggestion (mini chat input prompt)
- File: `src/fullchat/prefillSuggestion.ts`
- Purpose: generate a short, single-line prompt to prefill the chat input.
- Model used: `gpt-4o` (forced for reliability).

2) Label rewriter (5 words -> 5 three-word phrases)
- File: `src/ai/labelRewriter.ts`
- Purpose: turn 5 words into 5 short phrases.
- Model used: `gpt-4o`.

Both flows use the same OpenAI client implementation.

## 2) The AI client: where it lives
All AI calls go through a single client factory:

- Client factory: `src/ai/index.ts`
  - `createLLMClient(config)` returns a client based on `mode`.
  - Current modes: `openai` and `openrouter`.

- OpenAI client: `src/ai/openaiClient.ts`
  - Implements the actual HTTP call to OpenAI.
  - Endpoint: `https://api.openai.com/v1/chat/completions`.
  - Payload fields:
    - `model`
    - `messages` (only user role right now)
    - `temperature`
    - `max_completion_tokens`

## 3) Configuration: where the API key and mode come from
These values come from environment variables:

- API key: `VITE_OPENAI_API_KEY`
  - Read inside `prefillSuggestion.ts` and `labelRewriter.ts`.

- AI mode: `VITE_AI_MODE`
  - Read in `src/config/aiMode.ts` (used by `prefillSuggestion.ts`).
  - Modes:
    - `mock` (default, no network)
    - `real` (calls OpenAI)

Runtime override for mode:
- `window.ARNVOID_AI_MODE = 'real'` in browser console.

## 4) Prefill flow: how the data moves
File: `src/fullchat/prefillSuggestion.ts`

Flow:
1) `refinePromptAsync(context, options)` is called.
2) It checks AI mode via `getAiMode()`:
   - `mock` -> `refinePromptMock(...)`
   - `real` -> `refinePromptWithReal(...)`
3) `refinePromptWithReal(...)`:
   - Reads `VITE_OPENAI_API_KEY`.
   - Builds a "context packet" from the node label and recent chat.
   - Builds a system-style instruction string (but it is passed as user content).
   - Calls `client.generateText(...)` with:
     - `model: gpt-4o`
     - `temperature: 0.3`
     - `maxTokens: 60`
4) Output is sanitized:
   - strip quotes
   - collapse whitespace
   - truncate to 160 chars
5) If empty or error:
   - fallback to mock result

Important: The "system prompt" is currently included in the user prompt text.
If you need a real system role, update `OpenAIClient` to accept messages.

## 5) Label rewriter flow: how the data moves
File: `src/ai/labelRewriter.ts`

Flow:
1) `makeThreeWordLabels(words)` is called with 5 words.
2) Reads `VITE_OPENAI_API_KEY`.
3) Builds a single prompt string with explicit format rules.
4) Calls `client.generateText(...)` with:
   - `model: gpt-4o`
   - `temperature: 0.3`
   - `maxTokens: 100`
5) Validates output: exactly 5 lines, 3 words each.
6) If invalid or error: fallback to original words.

## 6) Parameters: where to change them safely
There are two places to change parameters:

1) Per-call overrides:
- `prefillSuggestion.ts`:
  - `client.generateText(..., { model, temperature, maxTokens })`
- `labelRewriter.ts`:
  - `client.generateText(..., { model, temperature, maxTokens })`

2) Client defaults:
- `OpenAIClient` constructor in `src/ai/openaiClient.ts`
  - `defaultModel` is stored here
  - `generateText` uses it when `opts.model` is missing

Important: In OpenAIClient, some models only accept `temperature = 1`.
This repo currently coerces that value only for `gpt-4o*`, `o1*`, `o3*`.

## 7) What actually goes over the wire (OpenAI)
OpenAI payload (OpenAIClient):

```
POST https://api.openai.com/v1/chat/completions
{
  "model": "gpt-4o",
  "messages": [
    { "role": "user", "content": "<full prompt string>" }
  ],
  "temperature": 0.3,
  "max_completion_tokens": 60
}
```

Response parsing:
- The client expects `choices[0].message.content`.
- If that is missing, the client throws `No content in OpenAI response`.

## 8) Why gpt-4o is used for prefill right now
`gpt-4o-nano` sometimes returns a response shape that does not include
`choices[0].message.content` when used with `/chat/completions`.
That triggers "No content in OpenAI response".

To avoid that, prefill is pinned to `gpt-4o`, same as label rewriter.

## 9) How to add a new AI feature safely (reliable path)
Use this checklist:

1) Decide the AI mode behavior
- Should it fall back to mock on errors? (recommended)
- Should it block UI? (avoid)

2) Use the existing client factory
- `createLLMClient(...)` from `src/ai/index.ts`
- Do not call fetch directly in random files.

3) Keep prompt rules explicit
- Put clear formatting rules in the prompt.
- Add output validation and fallback.

4) Add timeouts and abort support
- Use `AbortController` or the `withTimeoutAndAbort(...)` pattern.
- Never leave unbounded network waits.

5) Avoid heavy logic in rAF paths
- AI calls must be outside render loops.

6) Log important failures
- Use short logs with labels to debug quickly.

## 10) How to make it even more reliable later (recommended)
These are safe improvements if you need production-grade reliability:

1) Add system-role support
- Update `OpenAIClient.generateText` to accept `system` and `user` messages.
- Allows cleaner prompts and avoids mixing instructions with content.

2) Add response-shape fallback parsing
- Accept `output_text` or `output[].content[].text` for Responses API.
- Useful if you re-enable `gpt-4o*`.

3) Add a tiny smoke test script
- A CLI script that sends one prompt and validates output format.
- Run it before shipping AI changes.

4) Centralize model selection
- Create a `src/ai/modelPolicy.ts` with allowed models and defaults.
- Avoid per-file drift.

## 11) Quick troubleshooting guide
Symptom: "No content in OpenAI response"
- Likely model or endpoint mismatch.
- Fix: use `gpt-4o` or add response-shape parser.

Symptom: "unsupported_value temperature"
- Model only supports temperature=1.
- Fix: pin to supported model or coerce temperature.

Symptom: fallback to mock always
- Check `VITE_AI_MODE=real`.
- Check `VITE_OPENAI_API_KEY` is set.

Symptom: timeout fallback
- Increase timeout or shorten prompt.
- Check network latency.

## 12) File map (fast reference)
- `src/ai/index.ts` -> AI client factory.
- `src/ai/openaiClient.ts` -> OpenAI HTTP implementation.
- `src/ai/labelRewriter.ts` -> label rewriter AI flow.
- `src/fullchat/prefillSuggestion.ts` -> prefill AI flow.
- `src/config/aiMode.ts` -> AI mode resolver.
- `.env` or `.env.local` -> API key and mode.
