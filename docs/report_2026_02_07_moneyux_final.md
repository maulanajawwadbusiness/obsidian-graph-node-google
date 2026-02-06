# Money UX Final Report (Balance, Shortage, Failure States)

Date: 2026-02-07

## Scope Summary
This work adds a money-UX loop across the frontend so users always see their rupiah balance, understand shortage before paid actions, and receive calm, explicit outcomes for payment, balance, and deduction failures.

## Key UX Additions
1) Always-visible balance anchor
- Component: src/components/BalanceBadge.tsx
- Always shown via src/screens/AppShell.tsx
- Format: "Rp 12.450" (no decimals)
- Loading: "Rp ..."
- Click badge to refresh balance

2) Shortage warning gate
- Component: src/components/ShortageWarning.tsx
- Global store: src/money/shortageStore.ts
- Gate helper: src/money/ensureSufficientBalance.ts
- Cost estimator: src/money/estimateCost.ts (word-based heuristic)
- Routes to topup via src/money/topupEvents.ts

3) Failure states and notices
- Notice system: src/money/moneyNotices.ts
- UI stack: src/components/MoneyNoticeStack.tsx
- Rendered globally in AppShell

## Where It Triggers
- Payment flow:
  - src/components/PaymentGopayPanel.tsx
  - Handles: cancel, network error, pending, success, fail/expire, timeout
  - Explicit saldo state in each message
  - "Cek ulang saldo" for delayed webhook cases

- Balance fetch:
  - src/components/BalanceBadge.tsx
  - Unauthorized and network failures show notice and retry CTA

- LLM deduction:
  - src/ai/paperAnalyzer.ts
  - src/fullchat/fullChatAi.ts
  - src/fullchat/prefillSuggestion.ts
  - Insufficient rupiah from server shows shortage warning + notice
  - Chat abort shows notice "respons dihentikan" + charging rule
  - Network issues show notice "saldo akan tersinkron"

## Edge Case Handling
- Balance unknown at gate: force refresh and wait; if still unknown, block with shortage modal.
- Chat mid-stream: if estimated cost exceeds balance, abort stream and show shortage modal.

## Files Added
- src/components/BalanceBadge.tsx
- src/components/ShortageWarning.tsx
- src/components/MoneyNoticeStack.tsx
- src/store/balanceStore.ts
- src/money/shortageStore.ts
- src/money/ensureSufficientBalance.ts
- src/money/estimateCost.ts
- src/money/topupEvents.ts
- src/money/moneyNotices.ts

## Files Updated
- src/screens/AppShell.tsx
- src/components/PaymentGopayPanel.tsx
- src/ai/paperAnalyzer.ts
- src/fullchat/fullChatAi.ts
- src/fullchat/prefillSuggestion.ts

## Reports Written
- docs/report_2026_02_06_payment_gopaypanel_scan.md
- docs/report_2026_02_07_moneyux_step1_balance_anchor.md
- docs/report_2026_02_07_moneyux_step4_shortage_warning.md
- docs/report_2026_02_07_moneyux_step7_failure_states.md

## Notes
- All UI uses rupiah (Rp) and explicitly states whether saldo changed.
- No secrets are logged or stored.
