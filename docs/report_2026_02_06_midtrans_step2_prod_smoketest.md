# Midtrans Step 2 - Production Charge Smoke Test
Date: 2026-02-06
Status: COMPLETE. CODE CHANGES MADE.

## Summary
Added a production smoke test script that performs a real Midtrans Core API /v2/charge call using the existing client and logs only safe summary fields. The raw response is written to a gitignored path for local inspection.

## Changes
- Added a one-off production charge smoke test script.
- Added npm script to run the smoke test.
- Added gitignore rule for smoke test output files.
- Updated CLAUDE.md with a hard rule to never write secrets into docs or logs.

## Files Touched
- src/server/src/midtrans/smoke.charge.prod.ts
- src/server/package.json
- .gitignore
- CLAUDE.md

## How To Run
- cd src/server
- npm run test:midtrans-prod-charge

## Output
The script prints only:
- http status
- order_id
- transaction_id
- transaction_status
- payment_type
- va_numbers or permata_va_number when present

No secrets or auth headers are printed. The raw response is saved to a gitignored file under tmp/midtrans/.
