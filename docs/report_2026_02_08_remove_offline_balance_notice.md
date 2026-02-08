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
1. Updated `BalanceBadge`:
   - `src/components/BalanceBadge.tsx`
   - For `status === 'error'`, money notice emission was removed.
   - This removes the reported popup in offline/unreachable scenarios.
2. Updated payment network-failure notices:
   - `src/components/PaymentGopayPanel.tsx`
   - Removed money notice emission on payment create network failures (both non-ok response and thrown fetch errors).
3. Updated AI chat network-failure notice:
   - `src/fullchat/fullChatAi.ts`
   - Removed fallback money notice (`Koneksi terputus`) on network failure.
4. Removed now-unused suppression helper:
   - deleted `src/money/moneyNoticePolicy.ts`

## Round 2 Final Trace Cleanup
- Re-ran trace for:
  - `Koneksi bermasalah. Saldo tidak berubah.`
  - `Koneksi terputus`
  - `shouldSuppressMoneyNoticeForNetworkFailure`
- Result: no runtime source traces remain in `src/` for these offline-network money notice paths.

## Expected Behavior After Patch
- If Wi-Fi is off or backend is unreachable, no money/balance notice popup is emitted for those network failures.
- `MoneyNoticeStack` can remain mounted globally and still show nothing for those offline/unreachable money notice paths.
