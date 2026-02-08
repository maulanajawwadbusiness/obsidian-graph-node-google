# Forensic Report: Payment Notification Spam and Random Panel Behavior

Date: 2026-02-08
Scope: Trace where payment-related notices are emitted, mounted, and surfaced; identify root causes for random/spam behavior.
Status: No code changes made. Investigation only.

## 1. Investigation Inputs
- docs/system.md
- docs/repo_xray.md
- docs/report_2026_02_07_moneyux_final.md
- docs/report_2026_02_07_moneyux_step7_failure_states.md
- docs/report_2026_02_06_payment_gopaypanel_scan.md

Primary code scanned:
- src/components/PaymentGopayPanel.tsx
- src/components/MoneyNoticeStack.tsx
- src/money/moneyNotices.ts
- src/components/BalanceBadge.tsx
- src/components/ShortageWarning.tsx
- src/money/topupEvents.ts
- src/screens/AppShell.tsx
- src/screens/EnterPrompt.tsx
- src/store/balanceStore.ts
- src/ai/paperAnalyzer.ts
- src/fullchat/fullChatAi.ts
- src/fullchat/prefillSuggestion.ts
- src/auth/LoginOverlay.tsx
- src/main.tsx

## 2. System Mount and Visibility Map

### 2.1 Global Notice Surface
- `MoneyNoticeStack` is globally mounted from `AppShell` when `screen === 'prompt' || screen === 'graph'`.
- Root: `src/screens/AppShell.tsx:39`, `src/screens/AppShell.tsx:44`, `src/screens/AppShell.tsx:48`.
- This means payment, balance, and deduction notices share one global stack.

### 2.2 Payment Panel Mount
- `PaymentGopayPanel` is mounted only in EnterPrompt screen.
- Root: `src/screens/EnterPrompt.tsx:38`.
- EnterPrompt also mounts `LoginOverlay` above it.
- Overlay z-index is 3000 (`src/auth/LoginOverlay.tsx`), payment panel is z-index 1900 (`src/components/PaymentGopayPanel.tsx:334`, `src/components/PaymentGopayPanel.tsx:349`).

### 2.3 Notice Store Behavior
- `pushMoneyNotice` prepends a new notice and keeps max 3.
- Root: `src/money/moneyNotices.ts:48`, `src/money/moneyNotices.ts:55`.
- No dedupe key, no cooldown, no auto-dismiss timer.
- `clearMoneyNotices()` exists but is not called anywhere.

## 3. Payment Notification Emitter Inventory (Exact)

In `src/components/PaymentGopayPanel.tsx`, payment notices are emitted at:
- Timeout warning: `src/components/PaymentGopayPanel.tsx:69`
- Success notice: `src/components/PaymentGopayPanel.tsx:92`
- Fail/expire notice: `src/components/PaymentGopayPanel.tsx:108`
- Pending notice on `orderId` effect: `src/components/PaymentGopayPanel.tsx:134`
- Create failure notice (result not ok): `src/components/PaymentGopayPanel.tsx:156`
- Create failure notice (catch): `src/components/PaymentGopayPanel.tsx:188`
- Close/cancel notice: `src/components/PaymentGopayPanel.tsx:225`

Related trigger entry:
- Topup bus subscription auto-opens panel: `src/components/PaymentGopayPanel.tsx:35`
- Event source: `src/components/ShortageWarning.tsx:48` via `openTopupPanel()`.

## 4. Non-Payment Emitters Sharing Same Stack

These appear in the same `MoneyNoticeStack` and can look like payment spam:
- Balance unauthorized/error notices from `BalanceBadge`: `src/components/BalanceBadge.tsx:29`
- Deduction warnings in analyzer: `src/ai/paperAnalyzer.ts:92`
- Deduction warnings/info in full chat: `src/fullchat/fullChatAi.ts:148`, `src/fullchat/fullChatAi.ts:165`, `src/fullchat/fullChatAi.ts:184`
- Deduction warning in prefill: `src/fullchat/prefillSuggestion.ts:139`

## 5. Root-Cause Forensics (Where, What, How, When)

### RC-1: Cancel Notice Fires Even for Simple Panel Close
Where:
- `src/components/PaymentGopayPanel.tsx:223` to `src/components/PaymentGopayPanel.tsx:230`

What:
- Clicking `Close` always pushes `"Pembayaran dibatalkan"` warning.

How:
- No guard checks whether a payment was actually started.

When user sees it:
- Any close action, including opening panel only to inspect and then closing.

Effect:
- Feels like false alarm or spam warning.

### RC-2: Polling Continues After Panel Close (Hidden Session Still Active)
Where:
- Poll start effect on orderId: `src/components/PaymentGopayPanel.tsx:131` to `src/components/PaymentGopayPanel.tsx:145`
- Close only flips UI open state: `src/components/PaymentGopayPanel.tsx:223`

What:
- Closing panel does not stop in-flight polling if `state.orderId` exists.

How:
- Poll stop callback is tied to effect cleanup/orderId change, not panel visibility.
- `setIsOpen(false)` does not reset `state.orderId` and does not call stop.

When user sees it:
- User closes panel during pending payment.
- Later, hidden poll resolves to success/fail/timeout and pushes new notices.

Effect:
- "Random" delayed notices appear after user thought flow was canceled.
- Can produce contradictory sequence: canceled notice first, then success or fail notice later.

### RC-3: Global Balance Notice Triggers on Prompt Mount Before Payment Intent
Where:
- Money UI shown on prompt screen: `src/screens/AppShell.tsx:39` to `src/screens/AppShell.tsx:49`
- Balance fetch trigger on idle: `src/components/BalanceBadge.tsx:17`
- Unauthorized/error notice push: `src/components/BalanceBadge.tsx:23` to `src/components/BalanceBadge.tsx:44`
- Unauthorized status source: `src/store/balanceStore.ts:66` to `src/store/balanceStore.ts:69`

What:
- Entering prompt can immediately push `Saldo belum tersedia` notice.

How:
- `BalanceBadge` auto-refreshes on mount; if user is not logged in yet, status becomes `unauthorized`; notice is pushed.
- This happens while `LoginOverlay` is open, so it looks like unsolicited money warning.

When user sees it:
- Prompt screen load with unauthenticated session.

Effect:
- Perceived as unneeded financial warning before user action.

### RC-4: One Shared Notice Bus for Payment + Balance + Deduction
Where:
- Shared stack: `src/components/MoneyNoticeStack.tsx`
- Shared store: `src/money/moneyNotices.ts`

What:
- Different systems emit into one visual stack with similar copy and CTA shape.

How:
- No source grouping, no channel separation, no route/screen scoping.

When user sees it:
- Chat/prefill/analyzer shortage notices and payment notices intermingle in time.

Effect:
- User perceives all cards as payment noise, even when source is deduction or balance.

### RC-5: No Notice Lifecycle Policy (Auto-Dismiss/Dedupe/Cooldown)
Where:
- Push logic only prepends and slices to 3: `src/money/moneyNotices.ts:55`
- Stack renders until manual dismiss: `src/components/MoneyNoticeStack.tsx:7` onward

What:
- Repetitive notices remain until manually closed.

How:
- No TTL timer.
- No dedupe key.
- No anti-burst cooldown.
- `clearMoneyNotices` unused.

When user sees it:
- Repeated retries, repeated failures, cross-feature emissions.

Effect:
- Stacked cards feel spammy and persistent.

### RC-6: StrictMode Can Amplify Initial Mount-Time Side Effects in Dev
Where:
- StrictMode enabled: `src/main.tsx:15`

What:
- Development-only remount behavior can duplicate mount-driven effects.

How:
- Components mount/unmount/remount during dev checks.
- Mount-triggered notice pathways (especially balance status transitions) can appear more than expected.

When user sees it:
- Local/dev testing sessions.

Effect:
- Reported randomness can be stronger in development than production.

## 6. Code Intersections and Conflicts

### 6.1 Payment Panel vs Local Phase Truth
- Local phase can become `cancelled` via close button (`src/components/PaymentGopayPanel.tsx:224`) while active polling still continues and later sets `success` or `failed` (`src/components/PaymentGopayPanel.tsx:90`, `src/components/PaymentGopayPanel.tsx:107`).
- This creates contradictory user narrative.

### 6.2 Login Overlay vs Money UX Auto-Notices
- `LoginOverlay` intentionally blocks auth path on prompt.
- Concurrently, money UI is active on prompt and can push unauthorized balance warning.
- Conflict is conceptual: auth gate says "sign in first" while money layer says "saldo unavailable" without user money intent.

### 6.3 Shortage CTA to Topup Event Bus
- Shortage modal button emits `openTopupPanel()` (`src/components/ShortageWarning.tsx:48`).
- Payment panel subscribes to this bus (`src/components/PaymentGopayPanel.tsx:35`).
- This cross-module coupling is valid but contributes to "panel appears by event" behavior.

## 7. Historical Forensics (When Introduced)

Key commits:
- `4aadf09` (2026-02-06T16:10:23+07:00): added base GoPay QRIS panel.
- `956cf03` (2026-02-07T01:04:13+07:00): added always-visible balance anchor.
- `f677b31` (2026-02-07T01:10:53+07:00): added shortage warning gate.
- `a4ca4a9` (2026-02-07T01:21:09+07:00): added failure-state notices across payment/balance/deduction.
- `5d43ec1` (2026-02-07T23:36:30+07:00): onboarding/payment layering changes.

Specific line provenance from `git blame`:
- Pending notice effect in payment panel was introduced in `a4ca4a9` (`src/components/PaymentGopayPanel.tsx:133` to `src/components/PaymentGopayPanel.tsx:142`).
- Cancel notice on close was introduced in `a4ca4a9` (`src/components/PaymentGopayPanel.tsx:225` to `src/components/PaymentGopayPanel.tsx:230`).
- Balance unauthorized/error notice effect was introduced in `a4ca4a9` (`src/components/BalanceBadge.tsx:23` to `src/components/BalanceBadge.tsx:44`).
- Money UI rendering on prompt/graph path was adjusted in `5d43ec1` (`src/screens/AppShell.tsx:39` to `src/screens/AppShell.tsx:49`).

## 8. Reproduction Paths (Current Behavior)

### Repro A: "I closed payment, why messages still appear?"
1. Go to prompt screen and open payment panel.
2. Generate QRIS so `state.orderId` exists.
3. Click `Close`.
4. Observe immediate cancel warning.
5. Wait for backend status progression.
6. Observe later success/fail/timeout notice despite panel being closed.

### Repro B: "Messages appear before I do payment"
1. Go to prompt screen while logged out.
2. `BalanceBadge` auto-refresh runs.
3. Unauthorized balance status pushes warning notice.
4. User sees money warning while still at login overlay.

### Repro C: "Notice stack feels random"
1. Trigger chat/prefill/analyzer shortage notice in graph.
2. Trigger payment notices later in prompt.
3. Observe all cards mixed in same stack with max-3 rolling replacement.

## 9. Forensic Conclusion
The random/spam behavior is rooted in event overlap and lifecycle gaps, not one single emitter.

Primary root is `PaymentGopayPanel` close behavior vs polling lifecycle:
- Close emits cancel warning unconditionally.
- Close does not terminate existing poll loop.

Secondary root is shared global notice architecture:
- Payment, balance, and deduction events are merged into one persistent stack with no dedupe/TTL.
- Prompt screen shows money UI while login gate is active, producing unsolicited balance notices.

No source code changes were applied in this investigation.
