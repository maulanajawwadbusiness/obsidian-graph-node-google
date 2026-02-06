# System Notes (Arnvoid)

## Purpose
Central operating notes for backend/frontend behavior, integration seams, and live environment assumptions.

## LLM Provider Policy
- Provider routing is policy-driven (daily cohort + per-user cap + global pool).
- See test verification report: `docs/report_2026_02_06_provider_step4_test_results.md`.
- Real token counting uses provider usage when available, tokenizer fallback otherwise.
- Free pool decrements are idempotent via `openai_free_pool_ledger`.

## LLM Endpoints
Backend LLM endpoints:
- `POST /api/llm/paper-analyze`
- `POST /api/llm/chat`
- `POST /api/llm/prefill`

## LLM Audit
- Per-request audit records are stored in `llm_request_audit`.
- Audit includes provider/model, token counts, rupiah cost, and free pool metadata.

## Payments (GoPay QRIS)
Backend:
- `POST /api/payments/gopayqris/create`
- `GET /api/payments/:orderId/status`
- `POST /api/payments/webhook`

Frontend:
- `src/components/PaymentGopayPanel.tsx`
- `src/components/PromptCard.tsx`

## Auth
- Cookie name: `arnvoid_session`
- `/me` is the only source of truth for user state.
- All backend calls must include `credentials: "include"`.

## Fonts
- UI default: Quicksand (via CSS vars)
- Titles: Segoe UI -> Public Sans -> system
