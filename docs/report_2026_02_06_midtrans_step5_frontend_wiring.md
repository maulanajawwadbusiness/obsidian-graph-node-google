# Midtrans Step 5 - Frontend GoPay QRIS Wiring
Date: 2026-02-06
Status: COMPLETE. CODE CHANGES MADE.

## Summary
Added a minimal GoPay QRIS payment UI to the onboarding EnterPrompt screen. The UI can create a payment, render QR, open GoPay deeplink, and poll status until completion. API helpers were added for POST create and GET status calls with credentials.

## UI Placement
- PromptCard now includes PaymentGopayPanel in the top-right area.
- Files:
  - src/components/PromptCard.tsx
  - src/components/PaymentGopayPanel.tsx

## API Helpers
- src/api.ts
  - apiPost (credentials: include)
  - createPaymentGopayQris(grossAmount?)
  - getPaymentStatus(orderId)

## Polling Behavior
- Interval ramp:
  - 1s for first 10s
  - 2.5s afterward
- Timeout: 3 minutes
- Stops on: settlement, capture, deny, cancel, expire, failed, timeout
- Logs only on status transition

## UI Behavior
- Amount input defaults to 1000 IDR
- Generate QR triggers POST /api/payments/gopayqris/create
- QR is rendered from action name qr-code or generate-qr-code
- Open GoPay uses deeplink-redirect action URL
- Status is displayed and updates via polling
- Payment complete message appears on settlement or capture

## Files Touched
- src/components/PaymentGopayPanel.tsx
- src/components/PromptCard.tsx
- src/api.ts

## Manual Test Plan
- Login, open EnterPrompt screen, click Pay
- Generate QR, confirm QR image renders
- Open GoPay deeplink on mobile
- Complete payment and observe status update to paid
