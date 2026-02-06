# Money UX Step 1 - Balance Anchor

Date: 2026-02-07

## Summary
Added an always-visible rupiah balance anchor (Saldo) that stays on screen across all app flows (welcome, prompt, graph). The badge uses a shared balance store and refresh method, so payment success and LLM deductions can refresh the display without page reloads.

## UI Placement
- Component: src/components/BalanceBadge.tsx
- Rendered in: src/screens/AppShell.tsx (always present)
- Position: fixed top-right, calm pill style, no gamification
- Loading state: shows "Rp ..." when balance is unknown/loading

## Data Source
- Backend: GET /api/rupiah/me (auth required)
- Frontend store: src/store/balanceStore.ts
  - status: idle | loading | ready | error | unauthorized
  - balanceIdr + updatedAt
  - refreshBalance() for global refresh

## Refresh Triggers
- App load: BalanceBadge triggers refresh when status is idle
- Payment success: src/components/PaymentGopayPanel.tsx calls refreshBalance on settlement/capture
- LLM deduction finalize:
  - src/ai/paperAnalyzer.ts (finally)
  - src/fullchat/fullChatAi.ts (finally after stream)
  - src/fullchat/prefillSuggestion.ts (after real call)

## UX Notes
- Balance is always visible and does not block user actions if the fetch is slow or fails.
- When unauthorized or unavailable, the badge remains visible with neutral loading display.

## Files Touched
- src/components/BalanceBadge.tsx (new)
- src/store/balanceStore.ts (new)
- src/screens/AppShell.tsx
- src/components/PaymentGopayPanel.tsx
- src/ai/paperAnalyzer.ts
- src/fullchat/fullChatAi.ts
- src/fullchat/prefillSuggestion.ts
