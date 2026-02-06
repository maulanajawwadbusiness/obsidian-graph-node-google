# Money UX Step 4 - Shortage Warning

Date: 2026-02-07

## Summary
Implemented a global shortage warning that blocks paid LLM actions when rupiah balance is insufficient. The warning shows saldo, estimated cost, and exact shortfall, and routes users directly to topup.

## UI
- Component: src/components/ShortageWarning.tsx
- Shown globally via src/screens/AppShell.tsx
- Displays:
  - Saldo (Rp)
  - Perkiraan biaya (Rp)
  - Kekurangan (Rp)
- Actions:
  - Primary: "Isi saldo" (opens payment panel)
  - Secondary: "Batal"

## Data + Behavior
- Store: src/money/shortageStore.ts
- Trigger helper: src/money/ensureSufficientBalance.ts
- Topup trigger bus: src/money/topupEvents.ts (PaymentGopayPanel listens)

## Gates (before paid calls)
- Paper analyze: src/ai/paperAnalyzer.ts
- Chat stream: src/fullchat/fullChatAi.ts
- Prefill: src/fullchat/prefillSuggestion.ts

## Cost Estimation (client-side, rough)
- Estimator: src/money/estimateCost.ts
- Uses a word-count heuristic with caps to produce a requiredIdr number.
- UI labels it as "Perkiraan biaya" to signal it is an estimate.

## Topup Routing
- Shortage warning calls openTopupPanel() which opens PaymentGopayPanel.

## Notes / Limitations
- Mid-stream insufficiency is handled by gating before stream; mid-stream stop is not yet implemented.
- If balance is unknown, gating does not block (avoids false negatives).

## Files Touched
- src/components/ShortageWarning.tsx (new)
- src/money/shortageStore.ts (new)
- src/money/ensureSufficientBalance.ts (new)
- src/money/estimateCost.ts (new)
- src/money/topupEvents.ts (new)
- src/components/PaymentGopayPanel.tsx
- src/screens/AppShell.tsx
- src/ai/paperAnalyzer.ts
- src/fullchat/fullChatAi.ts
- src/fullchat/prefillSuggestion.ts
