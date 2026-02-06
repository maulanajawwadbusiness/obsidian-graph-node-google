# Money UX Step 7 - Failure States

Date: 2026-02-07

## Summary
Added a consistent money notice system and mapped failure states across payment, balance, and deduction flows. Users now get clear outcomes with explicit saldo change status and next actions.

## Money Notice System
- Store: src/money/moneyNotices.ts
- UI: src/components/MoneyNoticeStack.tsx
- Rendered globally via src/screens/AppShell.tsx
- Standard payload: kind, status, title, message, ctas

## Payment Flow (PaymentGopayPanel)
States handled:
- Cancel/close: "Pembayaran dibatalkan" (saldo tidak berubah)
- Start/network error: "Gagal memulai pembayaran" (saldo tidak berubah) + retry
- Pending: "Menunggu pembayaran" + "saldo akan diperbarui otomatis"
- Success: "Pembayaran berhasil" + "saldo bertambah" + refresh button
- Failed/expired: "Pembayaran gagal atau kedaluwarsa" (saldo tidak berubah)
- Timeout: "Pembayaran diproses" notice + refresh balance

Triggers:
- src/components/PaymentGopayPanel.tsx
- Notice CTAs: retry, cek ulang saldo

## Balance Fetch Failure
- Balance badge is always visible
- Unauthorized: notice with "silakan login" (saldo tidak berubah)
- Network error: notice "koneksi bermasalah" (saldo tidak berubah)
- Badge click triggers refreshBalance

Triggers:
- src/components/BalanceBadge.tsx

## Deduction Failures
- Insufficient rupiah (server): shortage warning + notice
  - Message: "Perkiraan biaya lebih kecil dari biaya akhir. Saldo tidak berubah."
- Chat abort by system: notice "respons dihentikan" + charging rule
- Network failure fallback: notice "koneksi terputus" + saldo sync

Triggers:
- src/ai/paperAnalyzer.ts
- src/fullchat/fullChatAi.ts
- src/fullchat/prefillSuggestion.ts

## Notes
- Notices do not block flows except shortage warning.
- No prompt or payment secrets are logged or displayed.

## Files Touched
- src/money/moneyNotices.ts (new)
- src/components/MoneyNoticeStack.tsx (new)
- src/components/BalanceBadge.tsx
- src/components/PaymentGopayPanel.tsx
- src/screens/AppShell.tsx
- src/ai/paperAnalyzer.ts
- src/fullchat/fullChatAi.ts
- src/fullchat/prefillSuggestion.ts
