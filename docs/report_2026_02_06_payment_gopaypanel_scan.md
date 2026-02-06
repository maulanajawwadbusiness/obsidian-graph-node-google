# PaymentGopayPanel scan (current state)

File: src/components/PaymentGopayPanel.tsx

## What it does now
- Uses createPaymentGopayQris and getPaymentStatus from src/api.
- Maintains local UI state: amount, isOpen, isBusy, error, lastStatus.
- Payment state stores: orderId, status, actions, lastUpdated.
- Polls payment status with a fast window (1s for 10s) then 2.5s, timeout at 3 minutes.

## Data it currently renders
- Amount input (IDR).
- Status text (pending, settlement, capture, etc.).
- Error string if any.
- QR image if action name is qr-code or generate-qr-code.
- Deeplink button if action name is deeplink-redirect.
- Success message for settlement or capture.

## UX structure now
- Toggle button in the top-right corner.
- Small fixed panel (280px wide) with minimal controls.
- One primary action (Generate QRIS), one secondary action (Open Wallet).

## Gaps for "knife-sharp" money UX
- No balance visibility (user does not see current rupiah balance).
- No payment metadata (order_id, transaction_id, last updated time).
- No clear timeline or state transitions beyond a single status label.
- No breakdown of action URLs (QR vs deeplink) beyond buttons.
- No explicit success summary (amount, reference, timestamps).

## Next data needs (if we want high clarity)
- Current rupiah balance and last update time.
- Order_id and transaction_id (for user control and support).
- Last status update timestamp.
- Action availability summary (QR ready, deeplink ready).
- Optional: charge amount confirmation after settlement.
