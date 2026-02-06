# Midtrans Step 3 - Production GoPay QRIS Smoke Test
Date: 2026-02-06
Status: COMPLETE. CODE CHANGES MADE.

## Summary
Added a production GoPay QRIS smoke test script that calls POST /v2/charge with payment_type "gopay" and prints only the safe summary fields needed for QR and deep link flows. The full response is saved to a gitignored local path for inspection.

## Changes
- Added GoPay QRIS smoke test script.
- Added npm script to run it.
- Added gitignore entry for local response file.
- Reinforced secrets policy in CLAUDE.md.

## Files Touched
- src/server/src/midtrans/smoke.gopayqris.prod.ts
- src/server/package.json
- .gitignore
- CLAUDE.md

## How To Run
- cd src/server
- npm run test:midtrans-prod-gopayqris

## Output Fields (console)
- status_code, status_message
- order_id, transaction_id
- transaction_status, payment_type
- actions (name + method + url)

## Frontend Usage Note
- Use action name "qr-code" URL for desktop QRIS display.
- Use action name "deeplink-redirect" URL for mobile redirect.

## Local Response File
- .local/midtrans-last-response.json (gitignored)
- Do not paste full response into docs.
