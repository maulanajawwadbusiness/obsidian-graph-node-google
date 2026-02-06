# Midtrans Step 4 - Backend Wiring Full Report
Date: 2026-02-06
Status: COMPLETE. CODE CHANGES MADE.

## Summary
Step 4 backend wiring is complete: schema, create/status routes, and webhook processing for GoPay QRIS are implemented. Migrations are applied and tables exist. The node-pg-migrate module type warning is fixed by converting migration files to CommonJS exports.

## Verification Results
Database checks (via node pg client using DATABASE_URL):
- pgmigrations shows both migrations applied:
  - 1770332268745_init-tables
  - 1770367000000_add_payment_tables
- Tables exist:
  - payment_transactions
  - payment_webhook_events

Note:
- `npm run migrate up` reports "No migrations to run", which is expected given pgmigrations entries.

## Schema (node-pg-migrate)
Migration file:
- src/server/migrations/1770367000000_add_payment_tables.js

Tables:
1) payment_transactions
- id (uuid, pk)
- user_id (bigint, fk users.id)
- order_id (unique)
- gross_amount (integer)
- payment_type (varchar)
- status (varchar)
- midtrans_transaction_id (unique, nullable)
- midtrans_response_json (jsonb)
- created_at, updated_at, paid_at

Indexes:
- order_id (unique)
- user_id
- status
- midtrans_transaction_id (unique)

2) payment_webhook_events
- id (uuid, pk)
- received_at (timestamp)
- order_id
- midtrans_transaction_id
- raw_body (jsonb)
- signature_key (varchar)
- is_verified (bool)
- processed (bool)
- processing_error (text)

Indexes:
- order_id
- midtrans_transaction_id

## Backend Endpoints
1) Create payment (auth required)
- POST /api/payments/gopayqris/create
- Request: { gross_amount?: number }
- Behavior:
  - Inserts payment_transactions row with status=created
  - Calls Midtrans /v2/charge (payment_type=gopay)
  - Stores midtrans_response_json and midtrans_transaction_id
  - Updates status to pending
  - Returns actions array for QR and deep link usage

2) Get status (auth required)
- GET /api/payments/:orderId/status
- Behavior:
  - Reads DB row
  - If status is pending, calls Midtrans /v2/{order_id}/status
  - Updates DB status, midtrans_transaction_id, paid_at if settlement or capture

3) Webhook (public, no auth cookie)
- POST /api/payments/webhook
- Behavior:
  - Registered before CORS
  - Verifies signature_key via sha512(order_id + status_code + gross_amount + server_key)
  - Stores webhook event row
  - Idempotently updates payment_transactions (paid_at only when null)
  - Responds 200 OK

## Module Warning Fix
- Converted migration files to CommonJS exports:
  - src/server/migrations/1770332268745_init-tables.js
  - src/server/migrations/1770367000000_add_payment_tables.js

This removes the node-pg-migrate module type warning.

## Files Touched
- src/server/migrations/1770332268745_init-tables.js
- src/server/migrations/1770367000000_add_payment_tables.js
- src/server/src/index.ts
- docs/report_2026_02_06_midtrans_step4_backend_wiring.md

## Notes
- No secrets were written to code, docs, or logs.
- Local env files are not committed.
- The .env.production file was modified locally by the user and remains uncommitted.

## Next Steps
- Run authenticated create endpoint locally and confirm actions include qr-code and deeplink-redirect.
- Replay a saved webhook body locally (not committed) to verify idempotent update behavior.
