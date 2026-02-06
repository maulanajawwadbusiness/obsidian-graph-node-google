# Credits Ledger Balance Forensic Scan (2026-02-06)

Scope: Scan only. No code changes. Evidence from repo files with line ranges.

## Observed Facts

### A) Identity binding (Google account to user_id)
- Server reads session cookie, looks up sessions.user_id, joins users.id, and stores user context with both users.id and users.google_sub. Evidence: src/server/src/index.ts:155-179.
- /auth/google upserts users row keyed by google_sub and returns user.google_sub to client, not users.id. Evidence: src/server/src/index.ts:337-382.
- /me endpoint returns google_sub, email, name, picture and does not return users.id. Evidence: src/server/src/index.ts:385-432.
- Frontend AuthProvider expects a User shape with id: number and consumes /me response via apiGet, but /me does not include id. Evidence: src/auth/AuthProvider.tsx:13-87; src/server/src/index.ts:385-432.

### B) Existing payment spine (tables + webhook + status)
- payment_transactions table schema: id uuid (pk), user_id bigint fk users(id), order_id unique, gross_amount integer, payment_type, status, midtrans_transaction_id, midtrans_response_json jsonb, created_at, updated_at, paid_at. Evidence: src/server/migrations/1770367000000_add_payment_tables.js:4-55.
- payment_webhook_events table schema: id uuid (pk), received_at, order_id, midtrans_transaction_id, raw_body jsonb, signature_key, is_verified, processed, processing_error. Evidence: src/server/migrations/1770367000000_add_payment_tables.js:57-97.
- Webhook inserts a payment_webhook_events row, verifies signature, and updates payment_transactions status and paid_at using a guarded update in a DB transaction. Evidence: src/server/src/index.ts:185-259.
- paid_at is set only when transaction_status is settlement or capture. Evidence: src/server/src/index.ts:134-136; 213-225.
- /api/payments/gopayqris/create inserts payment_transactions with status "created" and then updates status to the Midtrans response transaction_status (default pending). Evidence: src/server/src/index.ts:455-551.
- /api/payments/:orderId/status refreshes status for pending rows and also sets paid_at when settlement/capture. Evidence: src/server/src/index.ts:554-633.

### C) DB access + transactions
- DB pool is created via getPool() using @google-cloud/cloud-sql-connector and pg Pool. Evidence: src/server/src/db.ts:1-30.
- There is no shared transaction helper; most queries use pool.query directly. Evidence: src/server/src/index.ts:163-182; 467-474; 528-538; 562-598.
- The only explicit BEGIN/COMMIT/ROLLBACK in repo is the webhook update block. Evidence: src/server/src/index.ts:213-235.
- UUIDs are app-generated (crypto.randomUUID) rather than DB default functions. Evidence: src/server/src/index.ts:188; 465; src/server/migrations/1770367000000_add_payment_tables.js:4-9.
- Migrations do not define users or sessions tables (init migration is empty). Evidence: src/server/migrations/1770332268745_init-tables.js:1-18.

### D) Where deduction would need to be called (current compute paths)
- Document analysis calls analyzeDocument (LLM call) inside applyAnalysisToNodes; this is a core AI compute path. Evidence: src/document/nodeBinding.ts:42-66.
- analyzeDocument uses client-side OpenAI API key and calls the LLM client directly from the frontend. Evidence: src/ai/paperAnalyzer.ts:42-60; 157-167.
- Full chat responses call LLM in fullChatAi when mode is real. Evidence: src/fullchat/fullChatAi.ts:35-99.
- Prefill suggestion refinement can call LLM in real mode. Evidence: src/fullchat/prefillSuggestion.ts:37-143.
- index.ts defines auth and payment routes; no analysis or LLM endpoints are present in this file. Evidence: src/server/src/index.ts:1-633.
- Client-side idempotency hints exist (runId in full chat prefill, requestId in document worker), but they are not tied to server-side payment or credit flows. Evidence: src/fullchat/FullChatStore.tsx:178-230; src/document/workerClient.ts:10-83.

### E) Frontend integration seams (balance display + top up entry)
- Payment UI is already placed on the prompt screen via PaymentGopayPanel inside PromptCard. Evidence: src/components/PromptCard.tsx:1-58.
- Payment UI uses createPaymentGopayQris and getPaymentStatus from api.ts. Evidence: src/components/PaymentGopayPanel.tsx:1-206; src/api.ts:133-141.
- api.ts uses fetch with credentials: "include" for all API calls. Evidence: src/api.ts:32-93.

## Implications (scan-based)
- /me does not expose users.id, but payment and future credit tables will want users.id as FK. If frontend needs user_id for credit display or ledger reads, it cannot get it from /me today. Evidence: src/server/src/index.ts:385-432; src/auth/AuthProvider.tsx:13-87; src/server/migrations/1770367000000_add_payment_tables.js:10-15.
- Because LLM compute happens on the client (OpenAI calls in frontend), a server-side credit deduction hook cannot be enforced without moving compute behind a server endpoint or adding a gating endpoint. Evidence: src/ai/paperAnalyzer.ts:42-60; src/fullchat/fullChatAi.ts:35-99.
- The only existing transactional code is in webhook handling; credit grant and deduction will need similar explicit transaction blocks or a shared helper. Evidence: src/server/src/index.ts:213-235; src/server/src/db.ts:1-30.
- Since users/sessions tables are not managed by migrations, new credit tables should not assume migrations created users/sessions. Evidence: src/server/migrations/1770332268745_init-tables.js:1-18; src/server/src/index.ts:337-357.

## Risks (evidence-backed)
- Double-credit risk if webhook retries and future credit grant is not idempotent. Webhook inserts events on each call and updates payment_transactions only in this block; a future credit grant must guard on order_id or paid_at. Evidence: src/server/src/index.ts:185-259; src/server/migrations/1770367000000_add_payment_tables.js:16-20; 47-49.
- Status poll and webhook race: both can set paid_at on the same order. Current code guards paid_at with a case expression, but a future credit grant could still run twice without an idempotency key. Evidence: src/server/src/index.ts:217-225; 586-595.
- Deduction race: frontend can trigger multiple AI calls in parallel (chat + analysis + prefill). Without a transaction and a balance check at the DB level, simultaneous deductions can go negative. Evidence: src/document/nodeBinding.ts:42-66; src/fullchat/fullChatAi.ts:35-99; src/fullchat/prefillSuggestion.ts:37-143.
- Identity mismatch risk: AuthProvider expects user.id, but /me returns sub; any credit balance endpoint keyed by user.id cannot be consumed correctly by current frontend without adjustment. Evidence: src/auth/AuthProvider.tsx:13-87; src/server/src/index.ts:385-432.
- If webhook arrives before create endpoint finishes, there is a window where payment_transactions row may not exist for update, leading to "order not found" in webhook processing. Evidence: src/server/src/index.ts:229-231; 455-475.

## Proposed Minimal Schema (scan-informed, not implemented)
- credits_balances(user_id pk, balance_int, updated_at)
- credits_ledger(id uuid, user_id, delta_int, kind, payment_transaction_id nullable, created_at)
- Required constraints:
  - credits_balances.user_id references users(id).
  - credits_ledger.user_id references users(id).
  - Unique credit grant per payment order: enforce via unique on payment_transaction_id in credits_ledger for kind='purchase' (or via unique on order_id mapped through payment_transactions).

Evidence links for rationale:
- user_id is bigint FK to users(id) in payment_transactions. Evidence: src/server/migrations/1770367000000_add_payment_tables.js:10-15.
- paid_at indicates settlement/capture, suitable as a gating signal for credit grant. Evidence: src/server/src/index.ts:134-136; 217-225; 582-595.
- UUIDs are app-generated for payment rows; ledger can follow same pattern. Evidence: src/server/src/index.ts:465; src/server/migrations/1770367000000_add_payment_tables.js:4-9.

## Appendix

### File map (scanned)
- src/server/src/index.ts
- src/server/src/db.ts
- src/server/migrations/1770367000000_add_payment_tables.js
- src/server/migrations/1770332268745_init-tables.js
- src/api.ts
- src/auth/AuthProvider.tsx
- src/components/PromptCard.tsx
- src/components/PaymentGopayPanel.tsx
- src/document/nodeBinding.ts
- src/ai/paperAnalyzer.ts
- src/fullchat/fullChatAi.ts
- src/fullchat/prefillSuggestion.ts
- src/fullchat/FullChatStore.tsx
- src/document/workerClient.ts

### Grep patterns and top hits (evidence-backed)
- "paid_at" => payment_transactions update and status logic. Evidence: src/server/src/index.ts:217-225; 586-595; src/server/migrations/1770367000000_add_payment_tables.js:47-49.
- "payment_transactions" => schema and route usage. Evidence: src/server/migrations/1770367000000_add_payment_tables.js:4-55; src/server/src/index.ts:470-538; 564-596.
- "BEGIN/COMMIT/ROLLBACK" => webhook transaction. Evidence: src/server/src/index.ts:213-235.
- "analysis" => AI analyzeDocument call site. Evidence: src/document/nodeBinding.ts:42-66.
- "openai" => client-side OpenAI usage. Evidence: src/ai/paperAnalyzer.ts:42-60; src/fullchat/fullChatAi.ts:44-71; src/fullchat/prefillSuggestion.ts:86-97.

End of scan.

## Followup (2026-02-06)
- Full chatbar panel and prefill will be disabled in UI, while keeping the toggle button visible. Evidence for current placement: src/playground/GraphPhysicsPlayground.tsx:806-842; full chat store toggle: src/fullchat/FullChatStore.tsx:30-47.
- Mini chatbar handoff button (handoff_minichat.png) will remain hidden so it cannot open full chat. Evidence for current button block: src/popup/MiniChatbar.tsx:357-490.
- Pricing deduction should only apply to analysis and mini chat flows for now, not full chat or prefill. Evidence for analysis path: src/document/nodeBinding.ts:42-66; evidence for mini chat UI entry: src/popup/MiniChatbar.tsx:343-491; evidence for full chat/prefill entry: src/fullchat/FullChatStore.tsx:76-235; src/fullchat/prefillSuggestion.ts:37-143.
