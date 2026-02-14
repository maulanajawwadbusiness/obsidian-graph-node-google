# Run 10c Report: Payments Routes Wiring

Date: 2026-02-14
Scope: wire payments modules into monolith with ordering parity

## Changes
- Updated `src/server/src/serverMonolith.ts`:
  - removed inline handlers:
    - `POST /api/payments/webhook`
    - `GET /api/rupiah/me`
    - `POST /api/payments/gopayqris/create`
    - `GET /api/payments/:orderId/status`
  - added imports:
    - `registerPaymentsWebhookRoute`
    - `registerRupiahAndPaymentsCreateRoutes`
    - `registerPaymentsStatusRoute`
  - registered webhook module at pre-CORS location
  - created shared `paymentsRouteDeps` object for non-webhook routes
  - registered rupiah/create routes before LLM deps block
  - registered status route in original slot after `registerLlmAnalyzeRoute`

## Order Parity Checklist
- Webhook registration remains before:
  - `app.use(cors(corsOptions))`
  - `app.options(/.*/, cors(corsOptions))`
- Non-webhook payments route ordering retained relative to LLM:
  - analyze registration first
  - payments status route next
  - prefill/chat registrations after

## Contract Parity Checklist
- Paths/methods unchanged.
- Status codes and response payload shapes preserved for:
  - `/api/rupiah/me`
  - `/api/payments/gopayqris/create`
  - `/api/payments/:orderId/status`
  - `/api/payments/webhook`
- Error strings preserved for create/status/webhook branches.
- Topup call sites preserved (create/status/webhook semantics unchanged).
