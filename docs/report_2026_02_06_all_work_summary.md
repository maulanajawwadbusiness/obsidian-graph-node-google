# Report: 2026-02-06 Work Summary

Date: 2026-02-06
Scope: Full summary of changes and decisions in this session.

## Summary
- Added server-side LLM client module and wired frontend LLM calls to backend endpoints.
- Added server safety limits, validation, per-user concurrency, and observability logs for LLM endpoints.
- Added LLM deployment notes, model defaults, and allowlist enforcement.
- Moved analysis loading state from overlay to a full-screen LoadingScreen driven by analysis start/finish, with a hard-fail error message.
- Continued Midtrans work (GoPay QRIS, backend wiring, UI entry), with reports already logged in docs.

## Major Code Changes

### LLM Server Client + Endpoints
- New LLM client module (Responses API wrapper) with structured/text/stream functions.
  - File: `src/server/src/llm/llmClient.ts`
- Server LLM endpoints now validate inputs, enforce caps, and limit concurrency.
  - File: `src/server/src/index.ts`
  - Validation helpers: `src/server/src/llm/validate.ts`
  - Limits: `src/server/src/llm/limits.ts`
- Observability:
  - Structured JSON log line per request with request_id, sizes, duration, and termination_reason.
  - time_to_first_token_ms for streaming.
  - In-memory counters with 60s log cadence.

### Frontend LLM Calls
- Frontend LLM calls now hit `/api/llm/*` endpoints instead of OpenAI directly.
  - Files:
    - `src/ai/paperAnalyzer.ts`
    - `src/fullchat/fullChatAi.ts`
    - `src/fullchat/prefillSuggestion.ts`
- Streaming now reads raw text chunks from `/api/llm/chat` and yields them unchanged.
- Client no longer depends on VITE_OPENAI_API_KEY in these paths.

### Analysis Loading State
- Removed `AnalysisOverlay` from the graph.
- Added full-screen `LoadingScreen` for analysis lifecycle.
  - File: `src/screens/LoadingScreen.tsx`
- Loading screen is driven by analysis start/finish and shows a hard-fail error message on analysis failure.
  - Files:
    - `src/document/nodeBinding.ts`
    - `src/store/documentStore.tsx`
    - `src/document/types.ts`
    - `src/playground/GraphPhysicsPlayground.tsx`

## Reports Added
- `docs/report_2026_02_06_llm_step3_server_client_module.md`
- `docs/report_2026_02_06_llm_step5_frontend_calls_server.md`
- `docs/report_2026_02_06_llm_step6_safety_limits.md`
- `docs/report_2026_02_06_llm_step7_observability.md`
- `docs/report_2026_02_06_llm_step8_deploy_env_cors_cookies.md`
- `docs/report_2026_02_06_client_llm_call_inventory.md`
- `docs/report_2026_02_06_llm_server_api_surface.md`
- `docs/report_2026_02_06_llm_server_api_surface_v2_sharp.md`
- `docs/report_2026_02_06_credits_ledger_balance_forensic_scan.md`
- `docs/report_2026_02_06_midtrans_step4_backend_wiring_full.md`
- `docs/report_2026_02_06_onboarding_enterprompt_payment_wiring.md`

## Notable Decisions
- LLM model policy is strict on the server: endpoint default model is used; invalid model -> 400.
- LLM endpoints use cookie auth and require credentials include.
- LLM streaming is raw text chunks (text/plain), no SSE framing.
- Analysis failure is now a hard-fail state on the loading screen (no placeholder fallback).

## Production Notes (No Secrets)
- Use Secret Manager for DB_PASSWORD and OPENAI_API_KEY.
- Cloud Run must provide OPENAI_API_KEY to server process.
- CORS allowlist must be set explicitly in prod if multiple domains are used.

## Tests
No automated tests were run in this session.

End of report.
