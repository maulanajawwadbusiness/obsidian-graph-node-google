# Beta Free Mode + Word Limits Scan Report
Date: 2026-02-17
Scope: Scan and dissect only. No implementation plan, no behavior changes.

## Section A: Payment/Credits Gating Locations and Current Behavior

### Frontend payment and balance gates
- `src/config/onboardingUiFlags.ts:6`
  - `SHOW_ENTERPROMPT_PAYMENT_PANEL = false` (payment launcher hidden on prompt by default).
- `src/config/onboardingUiFlags.ts:9`
  - `SHOW_ENTERPROMPT_BALANCE_BADGE = false` (balance badge hidden by default).
- `src/screens/EnterPrompt.tsx:138`
  - `PaymentGopayPanel` mounts only when `SHOW_ENTERPROMPT_PAYMENT_PANEL` is true.
- `src/money/ensureSufficientBalance.ts:23`
  - `ensureSufficientBalance(...)` is the client-side balance gate used by analysis/chat/prefill clients.
- `src/money/ensureSufficientBalance.ts:5`
  - Dev bypass only: `VITE_DEV_BYPASS_BALANCE === '1'` in dev skips client balance gate.
- `src/ai/paperAnalyzer.ts:268`
  - Analysis precheck calls `ensureSufficientBalance` and throws `insufficient_balance` when blocked.
- `src/fullchat/fullChatAi.ts:67`
  - Chat precheck calls `ensureSufficientBalance` before streaming.
- `src/fullchat/prefillSuggestion.ts:94`
  - Prefill precheck calls `ensureSufficientBalance` before `/api/llm/prefill`.

### Frontend UI where low-credit outcomes are surfaced
- `src/components/ShortageWarning.tsx:19`
  - Blocking shortage modal with topup CTA.
- `src/components/MoneyNoticeStack.tsx:4`
  - Global notice stack supports `info/warning/success/error` cards.
- `src/ai/paperAnalyzer.ts:310`
  - Handles backend `insufficient_rupiah` payload and opens shortage + warning notice.
- `src/fullchat/fullChatAi.ts:133`
  - Handles streamed `insufficient_rupiah` payload and opens shortage + warning notice.
- `src/fullchat/prefillSuggestion.ts:122`
  - Handles prefill `insufficient_rupiah` similarly.

### Backend enforcement where requests are rejected without credit
- `src/server/src/routes/llmAnalyzeRoute.ts:25`
  - `POST /api/llm/paper-analyze` is `requireAuth` protected.
- `src/server/src/routes/llmPrefillRoute.ts:20`
  - `POST /api/llm/prefill` is `requireAuth` protected.
- `src/server/src/routes/llmChatRoute.ts:21`
  - `POST /api/llm/chat` is `requireAuth` protected.
- `src/server/src/llm/billingFlow.ts:23`
  - `precheckBalance(...)` checks current rupiah balance.
- `src/server/src/llm/billingFlow.ts:42`
  - `chargeUsage(...)` performs post-usage deduction.
- `src/server/src/routes/llmAnalyzeRoute.ts:219`
- `src/server/src/routes/llmPrefillRoute.ts:225`
- `src/server/src/routes/llmChatRoute.ts:222`
  - Precheck before upstream LLM call; failures return 402 with `code: insufficient_rupiah`.
- `src/server/src/routes/llmAnalyzeRoute.ts:472`
- `src/server/src/routes/llmPrefillRoute.ts:335`
- `src/server/src/routes/llmChatRoute.ts:367`
  - Final charge after usage calculation; failures also map to `insufficient_rupiah` path.

### Backend payment routes and ledger plumbing
- `src/server/src/routes/paymentsRoutes.ts:32`
  - Registers `/api/rupiah/me`, `/api/payments/gopayqris/create`, `/api/payments/:orderId/status`.
- `src/server/src/routes/paymentsWebhookRoute.ts:30`
  - Registers `/api/payments/webhook`, verifies signature, updates transaction, applies topup.
- `src/server/src/server/bootstrap.ts:121`
  - Payments webhook is registered before CORS middleware.

### Environment and bypass decision points
- `src/server/src/server/envConfig.ts:70`
  - Server dev bypass: `DEV_BYPASS_BALANCE === "1"` and non-prod.
- `src/server/src/server/bootstrap.ts:62`
  - `isDevBalanceBypassEnabled()` wires bypass flag into llm route deps.

## Section B: Prompt/Send Pipeline Component Tree and State Flow

### Prompt surface ownership
- `src/screens/appshell/render/renderScreenContent.tsx:202`
  - Prompt screen renders `EnterPrompt`.
- `src/screens/EnterPrompt.tsx:127`
  - `EnterPrompt` renders `PromptCard`.
- `src/components/PromptCard.tsx:49`
  - `PromptCard` owns input textarea, upload picker, send button, and inline status banner.

### Prompt send path (text)
- `src/components/PromptCard.tsx:88`
  - `handleSubmit()` trims text and calls `onSubmit(trimmed)`.
- `src/screens/EnterPrompt.tsx:49`
  - `handlePromptSubmit(...)` forwards text via `onSubmitPromptText` then calls `onEnter()`.
- `src/screens/appshell/render/renderScreenContent.tsx:215`
  - `onSubmitPromptText` sets AppShell `pendingAnalysis` with kind `text`.
- `src/screens/appshell/render/renderScreenContent.tsx:198`
  - `onEnter` transitions to `graph_loading`.
- `src/playground/GraphPhysicsPlaygroundShell.tsx:1155`
  - Graph runtime consumes `pendingAnalysisPayload` and runs analysis path.

### Prompt send path (file upload)
- `src/components/PromptCard.tsx:156`
  - Hidden file input accepts `.pdf,.docx,.md,.markdown,.txt`.
- `src/screens/EnterPrompt.tsx:94`
  - `attachFromFiles(...)` keeps only last dropped/selected file.
- `src/screens/EnterPrompt.tsx:60`
  - File submit path forwards `onSubmitPromptFile` then `onEnter()`.
- `src/screens/appshell/render/renderScreenContent.tsx:220`
  - Sets AppShell `pendingAnalysis` with kind `file`.
- `src/playground/GraphPhysicsPlaygroundShell.tsx:1240`
  - File is parsed through `documentContext.parseFile(file)` before analyze.

### Where send is currently blocked or disabled
- `src/components/PromptCard.tsx:53`
  - `disabled` prop gates submit/button/input, but prompt path currently does not set this for quota/credit.
- `src/components/PromptCard.tsx:95`
  - Empty text submit can pass if `canSubmitWithoutText` and a file exists.
- `src/screens/EnterPrompt.tsx:130`
  - `PromptCard` is not passed a dynamic quota/credit disable condition today.

### Error surfacing path for prompt analysis
- `src/playground/GraphPhysicsPlaygroundShell.tsx:1492`
  - Runtime emits `{ isLoading, aiErrorMessage }` to AppShell.
- `src/screens/AppShell.tsx:854`
  - Gate error can be copied into `promptAnalysisErrorMessage` when returning to prompt.
- `src/screens/appshell/render/renderScreenContent.tsx:213`
  - Error message passed to `EnterPrompt`.
- `src/screens/EnterPrompt.tsx:135`
  - Error mapped to `PromptCard.statusMessage`.
- `src/components/PromptCard.tsx:135`
  - Inline dismissible banner rendered from `statusMessage`.

## Section C: Word/Token Counting and Availability Timing

### Existing word count logic
- `src/document/parsers/textParser.ts:21`
- `src/document/parsers/pdfParser.ts:60`
- `src/document/parsers/docxParser.ts:35`
  - Upload parsers compute `meta.wordCount` and `meta.charCount` during parse.
- `src/store/documentStore.tsx:117`
  - Parsed word count is logged and available after worker parse completes.
- `src/playground/GraphPhysicsPlaygroundShell.tsx:1183`
  - Pasted text path computes word count immediately via local `countWords(...)`.
- `src/document/nodeBinding.ts:39`
  - `countWords(...)` used when creating parsed document snapshot after analysis.

### Existing token count logic
- `src/server/src/pricing/tokenEstimate.ts:1`
  - Token estimate currently word-split based.
- `src/server/src/llm/usage/usageTracker.ts:97`
  - Records input estimates.
- `src/server/src/llm/usage/usageTracker.ts:125`
  - Streaming output estimate uses `countWordsWithCarry(...)`.
- `src/server/src/llm/usage/usageTracker.ts:214`
  - Attempts tokenizer-based finalization when possible.
- `src/server/src/llm/usage/usageTracker.ts:248`
  - Falls back to `source: estimate_wordcount`.

### Existing normalization/truncation points
- `src/ai/paperAnalyzer.ts:262`
  - Analysis text truncated to first 6000 chars client-side (`safeText`).
- `src/server/src/llm/limits.ts:3`
  - Analyze input hard limit is char-based (`paperAnalyzeTextMax = 80000`).
- `src/server/src/llm/validate.ts:64`
  - Backend rejects analyze requests with 413 when char limit exceeded.

### When counts are available before send
- Paste: available immediately in client before backend request (simple split logic exists in graph runtime).
- Upload: definitive word count only after parser worker finishes extraction (`parseFile` path). No pre-parse definitive word count found.
- Server-side tokens: available after request assembly/usage tracking; not currently exposed as pre-send prompt validation to UI.

## Section D: User Identity and Daily Usage Tracking Inventory

### Identity source of truth and auth attachment
- `src/server/src/auth/requireAuth.ts:24`
  - Session-cookie auth middleware loads `res.locals.user` from `sessions + users`.
- `src/server/src/server/bootstrap.ts:79`
  - `getUserId(user)` resolves request identity from auth context.
- `src/auth/AuthProvider.tsx:50`
  - Frontend user state bootstrapped from `/me`.
- `src/api.ts:58`
  - API helper sends `credentials: 'include'`.

### Existing daily usage and quota persistence
- `src/server/migrations/1770381000000_add_openai_free_pool_daily.js:4`
  - `openai_free_pool_daily` table.
- `src/server/migrations/1770381500000_add_openai_free_user_daily_usage.js:4`
  - `openai_free_user_daily_usage` table.
- `src/server/migrations/1770382000000_add_openai_free_pool_ledger.js:4`
  - `openai_free_pool_ledger` table.
- `src/server/src/llm/providerPolicyConfig.ts:1`
  - Current caps: global pool tokens/day, free users/day, user token cap/day.
- `src/server/src/llm/providerSelector.ts:22`
  - Date key generation and per-day selection path.
- `src/server/src/llm/providerSelector.ts:87`
  - Per-user daily cap check (`usedTokens >= cap`).
- `src/server/src/llm/freePoolAccounting.ts:3`
  - `recordTokenSpend(...)` transactionally decrements pool and increments user daily usage.
- `src/server/src/llm/providerRouter.ts:13`
  - Policy metadata attached to request routing.

### Existing day boundary behavior
- `src/server/src/llm/providerPolicyConfig.ts:4`
  - `DATE_KEY_TZ = "UTC"`.
- `src/server/src/llm/providerSelector.ts:22`
  - `getTodayDateKey()` currently returns UTC key.
- No scheduled reset job found; reset appears implicit by using a new `date_key` row per UTC date.

### Other quota/rate mechanisms present
- `src/server/src/llm/runtimeState.ts:8`
  - In-memory per-user concurrent request slots (`maxConcurrentLlm`, default 2).
- `src/server/src/routes/llmAnalyzeRoute.ts:142`
- `src/server/src/routes/llmPrefillRoute.ts:136`
- `src/server/src/routes/llmChatRoute.ts:141`
  - Enforced 429 when no slot available.

## Section E: UI Notification Component Options (Existing)

### Candidate 1: Prompt inline status banner
- `src/components/PromptCard.tsx:45`
  - Existing `statusMessage` prop.
- `src/components/PromptCard.tsx:353`
  - Existing red error banner style (`PROMPT_STATUS_BANNER_STYLE`).
- Current behavior: supports error-only shape (`{ kind: 'error'; text: string }`), dismiss button included.
- Fit: closest surface for "balloon under input" if extended to multi-state info/danger.

### Candidate 2: Global notice cards
- `src/components/MoneyNoticeStack.tsx:4`
  - Existing global card stack with statuses.
- `src/components/MoneyNoticeStack.tsx:120`
  - Status style map includes `info/warning/success/error`.
- Fit: good for transient app-level notices, less ideal for strict under-input validation state.

### Candidate 3: Blocking modal warning
- `src/components/ShortageWarning.tsx:19`
  - Existing modal warning with CTA actions.
- Fit: strong blocker for payment shortage, but heavier than requested small prompt balloon.

### Candidate 4: Session banner pattern
- `src/auth/SessionExpiryBanner.tsx:7`
  - Top-edge inline banner pattern with action buttons.
- Fit: demonstrates lightweight inline action banner, but anchored globally rather than prompt-card local.

## Section F: Risks and Unknowns Discovered

- Day boundary mismatch risk:
  - Existing daily quota keys are UTC (`DATE_KEY_TZ`), while product requirement text says "per day" without timezone clarification.
- Unit mismatch risk:
  - Existing backend daily controls are token-based, while requested limits are word-based.
- Multi-device concurrency risk:
  - Daily usage writes are transactional, but provider selection and later spend recording are separate steps; competing requests can still consume near the boundary.
- Upload pre-send certainty gap:
  - Definitive upload word count depends on parser completion; no pre-parse exact count path found.
- Offline/network failure UX split:
  - Prompt analysis errors route through graph gate and then back to prompt banner; chat/prefill use notice/shortage patterns.
- Existing char truncation interaction:
  - `paperAnalyzer` truncates to 6000 chars before backend call, while backend analyze accepts up to 80,000 chars. Word-limit enforcement semantics must account for this if kept.
- Auth dependency:
  - All llm/payment APIs are `requireAuth`; anonymous prompt send behavior cannot succeed on backend regardless of local UI state.

