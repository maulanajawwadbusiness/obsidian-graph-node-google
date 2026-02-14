# Run 10a Report: Payments Routes Module Add (Non-Webhook)

Date: 2026-02-14
Scope: module add only, no monolith wiring changes

## Added
- `src/server/src/routes/paymentsRoutes.ts`
- Exports:
  - `PaymentsRouteDeps`
  - `registerRupiahAndPaymentsCreateRoutes(app, deps)`
  - `registerPaymentsStatusRoute(app, deps)`

## Moved Route Surface Into Module
- `GET /api/rupiah/me`
- `POST /api/payments/gopayqris/create`
- `GET /api/payments/:orderId/status`

## Parity Notes
- Preserved `requireAuth` and `res.locals.user.id` usage.
- Preserved create route flow and responses:
  - gross amount validation (400)
  - transaction insert failure (500)
  - Midtrans charge failure (502 with `order_id`)
  - transaction store failure (500)
  - success payload shape including `actions`
- Preserved status route semantics:
  - missing orderId (400)
  - not found (404)
  - pending Midtrans success path with update and paid transition
  - pending Midtrans failure still returns `ok:true` with `midtrans_error`
  - paid/non-pending branch topup call semantics unchanged
- Preserved idempotency call sites for `applyTopupFromMidtrans`.

## Non-Changes
- No webhook extraction in this run.
- No monolith wiring changes yet.
- No ordering changes yet.
