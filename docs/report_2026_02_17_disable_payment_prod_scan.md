# Disable Payment in Prod — Forensic Scan Report
**Date:** 2026-02-17  
**Goal:** Identify every payment/balance/credits gate that can block a user in production, and recommend the cleanest way to disable payment gating during beta while keeping auth and safety.

---

## 1. Current Payment/Balance Gates (Backend)

### 1.1 Central Billing Hub — `billingFlow.ts`

**File:** `src/server/src/llm/billingFlow.ts`

| Function | Line | Role | Blocks user? |
|---|---|---|---|
| `precheckBalance()` | L23–39 | **Pre-flight gate.** Checks if `balance_idr >= neededIdr`. Returns `{ ok: false }` on shortfall. Skips check if `bypassBalance` is true. | **YES — hard block** |
| `chargeUsage()` | L42–82 | **Post-flight charge.** Deducts rupiah from the DB via `chargeForLlm()`. Returns `{ ok: false }` if balance insufficient at deduction time. Skips charge if `bypassBalance` is true. | **YES — hard block** |
| `estimateWithFx()` | L7–21 | Computes IDR cost estimate. Not a gate itself, but feeds into `precheckBalance`. | No |
| `applyFreepoolLedger()` | L84–122 | Records free-pool token spend. Post-charge, non-blocking. | No |

### 1.2 Rupiah Service (DB Layer) — `rupiahService.ts`

**File:** `src/server/src/rupiah/rupiahService.ts`

| Function | Line | Role |
|---|---|---|
| `getBalance()` | L69–88 | Reads user balance from `rupiah_balances` table. Used by `precheckBalance`. |
| `chargeForLlm()` | L136–185 | Transactional deduction: checks `balanceBefore < amountIdr` (L148) → returns `{ ok: false, code: "insufficient_rupiah" }`. Inserts into `rupiah_ledger`. |
| `applyTopupFromMidtrans()` | L90–134 | Applies top-up. Not a gate. |

### 1.3 Route-Level Gates (×3 routes, identical pattern)

Each of the three LLM routes follows the **same two-phase pattern**:

1. **Phase 1 (Pre-flight):** `const bypassBalance = deps.isDevBalanceBypassEnabled()` → `precheckBalance({ userId, neededIdr, bypassBalance })` → on failure: `res.status(402).json({ code: "insufficient_rupiah", ... })` + return.
2. **Phase 2 (Post-charge):** After LLM call completes: `chargeUsage({ userId, ..., bypassBalance })` → on failure: same 402 response.

| Route | File | Precheck line | Charge line | 402 return lines |
|---|---|---|---|---|
| `/api/llm/paper-analyze` | `src/server/src/routes/llmAnalyzeRoute.ts` | L219 | L472 | L240, L490 |
| `/api/llm/prefill` | `src/server/src/routes/llmPrefillRoute.ts` | L225 | L338 | L247, L354 |
| `/api/llm/chat` | `src/server/src/routes/llmChatRoute.ts` | L222 | L370 | L244, L390 |

### 1.4 Server Bypass (Currently Dev-Only)

**File:** `src/server/src/server/envConfig.ts` → L70

```typescript
devBypassBalanceEnabled: !isProd && process.env.DEV_BYPASS_BALANCE === "1",
```

This is read in `bootstrap.ts:62` as `isDevBalanceBypassEnabled()` and injected into all route deps.

> [!CAUTION]
> **This bypass is structurally impossible to activate in production** because of the `!isProd` guard. Any "beta free mode" solution must either remove the `!isProd` guard or add a new flag that works in prod.

### 1.5 Rate Limiter (Not a Payment Gate)

All three routes also call `deps.acquireLlmSlot(userId)` which returns 429 on concurrent request overflow. This is a **rate limiter, not a payment gate** — leave untouched.

### 1.6 Free Pool Accounting (Not a Gate)

**File:** `src/server/src/llm/freePoolAccounting.ts`

`recordTokenSpend()` writes to `openai_free_pool_ledger` and `openai_free_pool_daily`. This is **post-charge bookkeeping** — never blocks a request. It records free pool token consumption and is called via `applyFreepoolLedger()` after a successful charge. Leave untouched.

### 1.7 Payments Routes (Top-up Infrastructure)

**File:** `src/server/src/routes/paymentsRoutes.ts`

| Route | Line | Purpose |
|---|---|---|
| `GET /api/rupiah/me` | L36 | Returns balance to frontend. Not a gate. |
| `POST /api/payments/gopayqris/create` | L46 | Creates QRIS payment — used by top-up flow. Not a gate. |
| `GET /api/payments/:orderId/status` | L147 | Polls payment status. Not a gate. |

**File:** `src/server/src/routes/paymentsWebhookRoute.ts` — Midtrans webhook. Not a gate.

These routes can remain active (harmless) or be left alone during beta free mode.

---

## 2. Current Payment/Balance Gates (Frontend)

### 2.1 Client-Side Pre-Flight Gate — `ensureSufficientBalance()`

**File:** `src/money/ensureSufficientBalance.ts`

This is the **single choke point** for all client-side balance checks. It:
1. Reads cached balance from `balanceStore` (or force-refreshes)
2. If `balance < requiredIdr` → calls `showShortage(...)` (opens modal) → returns `false`
3. Caller sees `false` → **aborts the action** (no API call is made)

**Dev-only bypass (L4–6):**
```typescript
function isDevBalanceBypassEnabled(): boolean {
    return import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_BALANCE === '1';
}
```
This uses `import.meta.env.DEV` which is `false` in all Vite production builds — **never active in prod**.

### 2.2 Callers of `ensureSufficientBalance()`

| Caller | File | Line | Context |
|---|---|---|---|
| `paperAnalyzer.ts` | `src/ai/paperAnalyzer.ts` | L268 | Before `/api/llm/paper-analyze` — blocks analysis |
| `fullChatAi.ts` | `src/fullchat/fullChatAi.ts` | L67 | Before `/api/llm/chat` — blocks chat send |
| `prefillSuggestion.ts` | `src/fullchat/prefillSuggestion.ts` | L94 | Before `/api/llm/prefill` — blocks prefill |

Each caller also has **backend 402 error handling** that calls `showShortage()` independently:

| Caller | Backend 402 handler | Lines |
|---|---|---|
| `paperAnalyzer.ts` | `payload.code === 'insufficient_rupiah'` → `showShortage(...)` | L310–330 |
| `fullChatAi.ts` | `err.message.startsWith('insufficient_rupiah:')` → `showShortage(...)` | L133–155 |
| `prefillSuggestion.ts` | `payload.code === 'insufficient_rupiah'` → `showShortage(...)` | L122–142 |

### 2.3 Shortage UI Components

| Component | File | Mount point | Behavior |
|---|---|---|---|
| `ShortageWarning` | `src/components/ShortageWarning.tsx` | `AppShell.tsx:363` (global) | **Blocking modal** with backdrop. Shows balance / required / shortfall. Has "Isi saldo" button → `openTopupPanel()`. |
| `ChatShortageNotif` | `src/popup/ChatShortageNotif.tsx` | Anchored to chat UI (node-popup, mini-chat surfaces) | **Auto-hide toast** (3s). Shows "Saldo tidak cukup untuk chat". |
| `MoneyNoticeStack` | `src/components/MoneyNoticeStack.tsx` | `AppShell.tsx:364` (global) | Stack of `pushMoneyNotice()` messages from shortage handlers. |

### 2.4 Payment Panel and Balance Display

| Component | File | Status in prod |
|---|---|---|
| `PaymentGopayPanel` | `src/components/PaymentGopayPanel.tsx` | **Already disabled.** `SHOW_ENTERPROMPT_PAYMENT_PANEL = false` in `src/config/onboardingUiFlags.ts:6`. Only mounted in `EnterPrompt.tsx:138` when flag is true. |
| `BalanceBadge` | `src/components/BalanceBadge.tsx` | **Not mounted anywhere.** Exported but no import found in any screen or layout. |

### 2.5 Balance Store

**File:** `src/store/balanceStore.ts`

Fetches balance from `GET /api/rupiah/me`. Used by `ensureSufficientBalance()` and `BalanceBadge`. Not a gate itself, but feeds the gate.

### 2.6 Money Infrastructure (Non-Blocking)

| Module | File | Role |
|---|---|---|
| `topupEvents.ts` | `src/money/topupEvents.ts` | Event bus linking ShortageWarning → PaymentGopayPanel. |
| `moneyNotices.ts` | `src/money/moneyNotices.ts` | Push notification store for payment/balance events. |
| `shortageStore.ts` | `src/money/shortageStore.ts` | Zustand-like store for shortage modal state. |

---

## 3. Recommended "Beta Free Mode" Switch Design

### 3.1 Proposed Feature Flag

```
BETA_FREE_MODE=1
```

**Server:** New env var checked at startup in `envConfig.ts`.  
**Client:** New env var `VITE_BETA_FREE_MODE=1` added to `.env.production`.

### 3.2 Server-Side Hook Points (Primary — Must Do)

#### A. `envConfig.ts` — Add the flag

```diff
  return {
    // ... existing fields
    devBypassBalanceEnabled: !isProd && process.env.DEV_BYPASS_BALANCE === "1",
+   betaFreeMode: process.env.BETA_FREE_MODE === "1",
  };
```

#### B. `bootstrap.ts` — Wire the flag

Replace `isDevBalanceBypassEnabled()` logic or add a new function:

```diff
  function isDevBalanceBypassEnabled() {
-   return serverEnv.devBypassBalanceEnabled;
+   return serverEnv.devBypassBalanceEnabled || serverEnv.betaFreeMode;
  }
```

**Effect:** This single change makes `bypassBalance = true` in all 3 routes, which:
- `precheckBalance()` → returns `{ ok: true }` immediately (L28–29)
- `chargeUsage()` → returns `{ ok: true, chargeStatus: "bypassed_dev" }` immediately (L50–57)
- No DB reads, no balance checks, no 402 responses
- Audit still records `chargeStatus: "bypassed_dev"`, so usage is logged

> [!IMPORTANT]
> This is the **single most powerful change** — just one line in `bootstrap.ts` disables ALL server-side payment gating.

#### C. No changes needed in route files

The `bypassBalance` flag already flows through the entire billing pipeline. No route-level changes needed.

### 3.3 Client-Side Hook Points (Optional — Reduces Confusing UI)

#### A. `ensureSufficientBalance.ts` — Skip client-side gate

```diff
  function isDevBalanceBypassEnabled(): boolean {
-     return import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_BALANCE === '1';
+     return (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_BALANCE === '1')
+         || import.meta.env.VITE_BETA_FREE_MODE === '1';
  }
```

**Effect:** `ensureSufficientBalance()` always returns `true` → no shortage modal, no blocked actions.

#### B. `.env.production` — Enable the flag

```diff
+ VITE_BETA_FREE_MODE=1
```

#### C. Optional: Hide balance UI elements

- `ShortageWarning.tsx` — Will never trigger because `ensureSufficientBalance()` returns true and server never returns 402. No change needed.
- `BalanceBadge.tsx` — Not mounted anywhere. No change needed.
- `PaymentGopayPanel.tsx` — Already hidden by `SHOW_ENTERPROMPT_PAYMENT_PANEL = false`. No change needed.
- `MoneyNoticeStack` — Payment notices from `pushMoneyNotice()` won't fire if no shortage/402 occurs. No change needed.

### 3.4 What Stays Active Under the Flag

| System | Behavior | Why |
|---|---|---|
| **Auth** (`requireAuth`) | Still enforced on all LLM routes | Auth is separate from billing |
| **Rate limiter** (`acquireLlmSlot`) | Still enforced (429 on overload) | Protects server resources |
| **Free pool accounting** | Still runs (post-charge bookkeeping) | Usage tracking continues |
| **Audit records** | Still written with `chargeStatus: "bypassed_dev"` | Full observability |
| **Balance store / API** | `GET /api/rupiah/me` still works | No breakage, just unused |
| **Beta caps** (future) | To be implemented separately | Per-doc 7500 words, per-day 150k words |

---

## 4. Risks / Edge Cases

### 4.1 Downstream Assumes Charge Record Exists

The `rupiah_ledger` INSERT in `chargeForLlm()` is **skipped** when `bypassBalance` is true (the `chargeUsage()` function returns early at L50–57). Any dashboard or analytics that queries `rupiah_ledger` for usage data will see zero records during beta free mode.

**Mitigation:** The `llm_audit` table (via `upsertAuditRecord`) still gets a record with `charge_status: "bypassed_dev"`, so usage is trackable via audit. The `openai_free_pool_ledger` also still records token usage via `applyFreepoolLedger()`.

### 4.2 Balance Display Shows Rp 0

If a new user has no balance and `BalanceBadge` were ever mounted, it would show `Rp 0`. Currently `BalanceBadge` is not mounted, so this is not an issue. If you mount it later, consider hiding it during beta free mode.

### 4.3 Client-Side 402 Handling Becomes Dead Code

The `insufficient_rupiah` error handlers in `paperAnalyzer.ts`, `fullChatAi.ts`, and `prefillSuggestion.ts` become unreachable because the server never returns 402. This is harmless — they're try/catch branches that simply won't trigger.

### 4.4 Abuse Vector: Unlimited LLM Calls

With payment gating removed, any authenticated user can make unlimited LLM calls bounded only by the rate limiter (2 concurrent). The planned beta caps (per-doc 7500 words, per-day 150k words) should be implemented promptly after disabling payment to limit abuse.

### 4.5 Flag Naming: "bypassed_dev" Audit Value

When `BETA_FREE_MODE` triggers the bypass, audit records will show `chargeStatus: "bypassed_dev"`. This is technically inaccurate for prod beta free mode. Consider adding a new `chargeStatus: "bypassed_beta_free"` value if audit accuracy matters.

### 4.6 Reverting to Paid Mode

When beta ends and you re-enable payment, simply set `BETA_FREE_MODE=0` (or remove it). No code changes needed — the entire billing pipeline reactivates automatically.

---

## 5. Minimal Diffs Path (Smallest Safe Patch)

### Tier 1: Server-Only (Mandatory — 2 files, ~4 lines)

| File | Change | Lines affected |
|---|---|---|
| `src/server/src/server/envConfig.ts` | Add `betaFreeMode: process.env.BETA_FREE_MODE === "1"` to config type + return | +2 lines |
| `src/server/src/server/bootstrap.ts` | Change `isDevBalanceBypassEnabled()` to also return `true` when `betaFreeMode` is set | +1 line (modify existing return) |

**Total: ~3–4 lines changed.** This alone eliminates ALL 402 blocks in production.

### Tier 2: Client UX Polish (Optional — 2 files, ~3 lines)

| File | Change | Lines affected |
|---|---|---|
| `src/money/ensureSufficientBalance.ts` | Add `VITE_BETA_FREE_MODE` check to bypass function | +1 line |
| `.env.production` | Add `VITE_BETA_FREE_MODE=1` | +1 line |

**Effect:** Eliminates the client-side balance pre-check. Without this, the client would still attempt a balance check, find Rp 0, show the shortage modal momentarily, but the server would succeed anyway. With this fix, the client skips the check entirely — no confusing UI flash.

### Tier 3: Audit Hygiene (Optional — 1 file, ~5 lines)

Add a distinct `chargeStatus: "bypassed_beta_free"` value to `billingFlow.ts` when the bypass reason is beta-free-mode rather than dev. This improves audit trail clarity.

### Deployment Checklist

1. Set `BETA_FREE_MODE=1` in prod environment variables (Cloud Run / Vercel)
2. Set `VITE_BETA_FREE_MODE=1` in `.env.production` (if doing Tier 2)
3. Rebuild and deploy
4. Verify: logged-in user with Rp 0 balance can analyze a document without 402

---

## Appendix: Complete File Inventory

### Backend Files Involved in Payment Gating

| File | Role |
|---|---|
| `src/server/src/llm/billingFlow.ts` | Central billing: precheck + charge + freepool |
| `src/server/src/rupiah/rupiahService.ts` | DB: balance reads, charge writes, topup |
| `src/server/src/routes/llmAnalyzeRoute.ts` | Paper analyze route — 2 billing gates |
| `src/server/src/routes/llmPrefillRoute.ts` | Prefill route — 2 billing gates |
| `src/server/src/routes/llmChatRoute.ts` | Chat route — 2 billing gates |
| `src/server/src/server/envConfig.ts` | Flag: `devBypassBalanceEnabled` |
| `src/server/src/server/bootstrap.ts` | Wiring: `isDevBalanceBypassEnabled()` |
| `src/server/src/routes/paymentsRoutes.ts` | Top-up/balance API (not a gate) |
| `src/server/src/routes/paymentsWebhookRoute.ts` | Midtrans webhook (not a gate) |
| `src/server/src/llm/freePoolAccounting.ts` | Free pool bookkeeping (not a gate) |

### Frontend Files Involved in Payment Gating

| File | Role |
|---|---|
| `src/money/ensureSufficientBalance.ts` | Client-side balance gate (single choke point) |
| `src/ai/paperAnalyzer.ts` | Caller: analysis pre-check + 402 handler |
| `src/fullchat/fullChatAi.ts` | Caller: chat pre-check + 402 handler |
| `src/fullchat/prefillSuggestion.ts` | Caller: prefill pre-check + 402 handler |
| `src/money/shortageStore.ts` | Shortage modal state |
| `src/components/ShortageWarning.tsx` | Global shortage modal UI |
| `src/popup/ChatShortageNotif.tsx` | Anchored chat shortage toast |
| `src/components/PaymentGopayPanel.tsx` | QRIS payment UI (already disabled) |
| `src/components/BalanceBadge.tsx` | Balance display (not mounted) |
| `src/money/topupEvents.ts` | Shortage → payment panel bridge |
| `src/money/moneyNotices.ts` | Money notification store |
| `src/store/balanceStore.ts` | Balance fetch/cache |
| `src/config/onboardingUiFlags.ts` | `SHOW_ENTERPROMPT_PAYMENT_PANEL = false` |
