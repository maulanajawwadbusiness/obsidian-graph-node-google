# Report: Remove Offline Balance Money Notice Spam

Date: 2026-02-08

## Root Cause (Exact)
- Notice source: `src/components/BalanceBadge.tsx`
- Function scope: `BalanceBadge` second `React.useEffect` that reacts to store `status`
- Condition: when `status === 'error'`, it called `pushMoneyNotice(...)` with:
  - title: `Saldo belum terbaca`
  - message: `Koneksi bermasalah. Saldo tidak berubah.`
  - CTA: `Cek ulang saldo`

## What Was Removed/Changed
1. Added shared policy helper:
   - `src/money/moneyNoticePolicy.ts`
   - `shouldSuppressMoneyNoticeForNetworkFailure(...)`
2. Updated `BalanceBadge`:
   - `src/components/BalanceBadge.tsx`
   - For `status === 'error'`, money notice emission is now suppressed when offline or backend unreachable.
   - This removes the reported popup in offline/unreachable scenarios.
3. Updated payment network-failure notices:
   - `src/components/PaymentGopayPanel.tsx`
   - Suppressed money notice emission on payment create network failures (both non-ok response and thrown fetch errors) when offline/unreachable.
4. Updated AI chat network-failure notice:
   - `src/fullchat/fullChatAi.ts`
   - Suppressed fallback money notice (`Koneksi terputus`) when offline/unreachable.

## Expected Behavior After Patch
- If Wi-Fi is off or backend is unreachable, no money/balance notice popup is emitted for those network failures.
- `MoneyNoticeStack` can remain mounted globally and still show nothing for those offline/unreachable money notice paths.
