# Report: Money Notice Cleanup and EnterPrompt Top-Right Controls

Date: 2026-02-08
Scope: Full worklog for money notice forensic, offline notice removals, payment close-notice removal, and EnterPrompt top-right visibility toggles.

## 1. Request Summary
User requested four related outcomes:
1. Forensic trace of payment/money notifications and random popup behavior.
2. Remove offline money/balance notice spam entirely.
3. Remove payment cancel popup that appeared when closing `Pay with QRIS` panel.
4. Hide EnterPrompt top-right `Pay with QRIS` and `Saldo Rp ...` UI, with easy toggles.

## 2. Forensic Findings (Root Causes)

### 2.1 Exact origin of `Saldo belum terbaca`
- File: `src/components/BalanceBadge.tsx`
- Function area: second `React.useEffect` in `BalanceBadge`
- Condition: `status === 'error'` emitted:
  - title `Saldo belum terbaca`
  - message `Koneksi bermasalah. Saldo tidak berubah.`
  - CTA `Cek ulang saldo`

### 2.2 Notice system architecture that made it feel random
- Shared global stack: `src/components/MoneyNoticeStack.tsx`
- Shared store: `src/money/moneyNotices.ts`
- Multiple emitters feeding same stack:
  - `src/components/PaymentGopayPanel.tsx`
  - `src/components/BalanceBadge.tsx`
  - `src/fullchat/fullChatAi.ts`
  - `src/ai/paperAnalyzer.ts`
  - `src/fullchat/prefillSuggestion.ts`

### 2.3 Payment close popup source
- File: `src/components/PaymentGopayPanel.tsx`
- Close button handler emitted `pushMoneyNotice` with:
  - title `Pembayaran dibatalkan`
  - message `Saldo tidak berubah.`

## 3. Code Changes Applied

### 3.1 Offline balance notice removal
- `src/components/BalanceBadge.tsx`
- Removed `status === 'error'` money notice emission path.
- Result: no balance money popup on offline/backend-unreachable fetch errors.

### 3.2 Offline network money notices removed from payment/chat paths
- `src/components/PaymentGopayPanel.tsx`
  - removed money notice emission in payment create failure branches.
- `src/fullchat/fullChatAi.ts`
  - removed network fallback money notice emission (`Koneksi terputus`).

### 3.3 Cleanup of temporary suppression utility
- Deleted `src/money/moneyNoticePolicy.ts` after moving to hard removals.

### 3.4 Payment close popup removal
- `src/components/PaymentGopayPanel.tsx`
- Removed close-handler `pushMoneyNotice(...)`.
- Result: closing payment panel no longer creates notification card.

### 3.5 EnterPrompt top-right controls hidden with toggles
- Added flags in `src/config/onboardingUiFlags.ts`:
  - `SHOW_ENTERPROMPT_PAYMENT_PANEL = false`
  - `SHOW_ENTERPROMPT_BALANCE_BADGE = false`
- Wired payment panel visibility:
  - `src/screens/EnterPrompt.tsx`
  - `PaymentGopayPanel` renders only when `SHOW_ENTERPROMPT_PAYMENT_PANEL` is true.
- Wired balance badge visibility:
  - `src/screens/AppShell.tsx`
  - `BalanceBadge` on prompt screen renders only when `SHOW_ENTERPROMPT_BALANCE_BADGE` is true.
  - Graph screen balance badge remains visible by default.

## 4. Documentation Updates
- Updated `docs/system.md` to reflect current truth:
  - EnterPrompt payment panel is optional via UI flag.
  - Balance badge prompt visibility is flag-controlled.
  - Offline/backend-unreachable network failures no longer emit balance/payment/chat money notices.

## 5. Commit Chronology
- `20b3dac` - `remove offline balance money notice spam`
- `0a2d305` - `remove remaining offline money notice traces`
- Current work in this report includes additional top-right visibility toggle wiring and system doc update.

## 6. Verification Notes
- Local type/build checks were run during prior steps and passed.
- Manual acceptance intent:
  - Offline refresh should show no money popup notices.
  - Closing payment panel should show no cancel popup.
  - EnterPrompt top-right `Pay with QRIS` and `Saldo` are hidden with flags defaulted to `false`.

## 7. Final State
- Offline balance money popup traces removed from runtime.
- Payment close notification popup removed.
- EnterPrompt top-right payment and balance UI now easily toggled from `src/config/onboardingUiFlags.ts`.
