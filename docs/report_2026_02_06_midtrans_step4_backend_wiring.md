# Midtrans Step 4 - Backend GoPay QRIS Wiring
Date: 2026-02-06
Status: COMPLETE. CODE CHANGES MADE.

## Summary
Implemented backend wiring for GoPay QRIS payments: database schema, authenticated create/status endpoints, and public webhook processing with signature verification and idempotent updates. Webhook route is registered before CORS middleware.

## Database Schema (node-pg-migrate)
Tables:
- payment_transactions
  - id (uuid)
  - user_id (bigint, fk users.id)
  - order_id (unique)
  - gross_amount (integer)
  - payment_type (varchar)
  - status (varchar)
  - midtrans_transaction_id (unique, nullable)
  - midtrans_response_json (jsonb)
  - created_at, updated_at, paid_at
- payment_webhook_events
  - id (uuid)
  - received_at (timestamp)
  - order_id, midtrans_transaction_id
  - raw_body (jsonb)
  - signature_key (varchar)
  - is_verified (bool)
  - processed (bool)
  - processing_error (text)

Indexes:
- payment_transactions: order_id (unique), user_id, status, midtrans_transaction_id (unique)
- payment_webhook_events: order_id, midtrans_transaction_id

Migration file:
- src/server/migrations/1770367000000_add_payment_tables.js

## Endpoints
1) Create payment (auth required)
- POST /api/payments/gopayqris/create
- Request: { gross_amount?: number }
- Behavior:
  - Creates a payment_transactions row (status=created)
  - Calls Midtrans /v2/charge with payment_type=gopay
  - Stores midtrans_response_json and midtrans_transaction_id, status=pending
  - Returns actions array for QR or deep link usage

2) Get status (auth required)
- GET /api/payments/:orderId/status
- Behavior:
  - Returns DB status
  - If pending, calls Midtrans /v2/{order_id}/status and updates DB

3) Webhook (public)
- POST /api/payments/webhook
- Behavior:
  - Verifies signature_key via sha512(order_id + status_code + gross_amount + server_key)
  - Stores webhook event row
  - Idempotently updates payment_transactions (paid_at set only if empty)

## Verification
- Migration attempt: `npm run migrate up` failed because DATABASE_URL was not set.
- Local API testing requires an authenticated session and MIDTRANS_SERVER_KEY in env.

## Frontend Usage Note
- Use action name "qr-code" URL for desktop QRIS display.
- Use action name "deeplink-redirect" URL for mobile redirect.

## Files Touched
- src/server/migrations/1770367000000_add_payment_tables.js
- src/server/src/index.ts
