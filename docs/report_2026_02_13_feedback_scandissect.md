# Feedback + Admin Inbox Scandissect (2026-02-13)

## Scope
- Scan only. No feature code changes in this task.
- Target: implementable forensic map for:
  - Logged-in only feedback submit modal
  - Admin-only feedback inbox UI
  - Strict pointer and wheel shielding over canvas

## A) Entrypoint + UI ownership

### Sidebar "More" wiring and popup injection point
- Sidebar "More" nav row:
  - `src/components/Sidebar.tsx:682`
- More trigger handler:
  - `src/components/Sidebar.tsx:261`
  - `src/components/Sidebar.tsx:690`
- More popup root injection point:
  - `src/components/Sidebar.tsx:998`
  - `src/components/Sidebar.tsx:1001`
- Current Suggestion item is placeholder log only:
  - `src/components/Sidebar.tsx:1024`

### Best owner for new modal state
- Existing app-level modal ownership is in `AppShell` (search/profile/logout/delete):
  - Auth and sidebar wiring hub:
    - `src/screens/AppShell.tsx:266`
    - `src/screens/AppShell.tsx:1317`
    - `src/screens/AppShell.tsx:1336`
    - `src/screens/AppShell.tsx:1337`
  - AppShell shielding helper (reused by all overlays):
    - `src/screens/AppShell.tsx:333`
  - Existing overlay backdrops:
    - Search: `src/screens/AppShell.tsx:1556`
    - Profile: `src/screens/AppShell.tsx:1355`
    - Logout confirm: `src/screens/AppShell.tsx:1442`
- Recommendation: own Feedback modal state in `AppShell` (same pattern as search/profile/logout), and trigger it from Sidebar via callback prop.

### Layer constants and z-index ladder
- Layer constants:
  - `src/ui/layers.ts:1` to `src/ui/layers.ts:8`
- Current ladder:
  - `LAYER_SIDEBAR = 50`
  - `LAYER_SIDEBAR_ROW_MENU = 1400`
  - `LAYER_MODAL_SEARCH = 3100`
  - `LAYER_MODAL_DELETE = 3200`
  - `LAYER_MODAL_PROFILE = 3300`
  - `LAYER_MODAL_LOGOUT_CONFIRM = 3400`
  - `LAYER_OVERLAY_LOGIN = 5000`
- Recommendation: add feedback layers in the modal range:
  - `LAYER_MODAL_FEEDBACK = 3250`
  - `LAYER_MODAL_FEEDBACK_ADMIN = 3260`
  This keeps them above Search/Delete and below Profile/Logout if desired, or adjust upward to match product priority.

## B) Auth truth + identity fields

### Frontend user truth
- `useAuth` source and shape:
  - `src/auth/AuthProvider.tsx:10` (`User` type)
  - `src/auth/AuthProvider.tsx:45` (`refreshMe` from `/me`)
  - `src/auth/AuthProvider.tsx:163` (`useAuth`)
- User fields already include:
  - `id`, `sub`, `email`, `name`, `picture`, `displayName`, `username`
  - `src/auth/AuthProvider.tsx:10`

### Backend requireAuth and `res.locals.user`
- Auth context shape:
  - `src/server/src/serverMonolith.ts:40`
- `requireAuth` middleware:
  - `src/server/src/serverMonolith.ts:407`
- `res.locals.user` currently carries:
  - `id`, `google_sub`, `email`
  - set at `src/server/src/serverMonolith.ts:430`
- This is enough for feedback write and admin check by email.

### displayName/username status
- Profile columns detection:
  - `src/server/src/serverMonolith.ts:146`
- Exposed in `/auth/google` response:
  - `src/server/src/serverMonolith.ts:677`
  - `src/server/src/serverMonolith.ts:678`
- Exposed in `/me` response:
  - `src/server/src/serverMonolith.ts:738`
  - `src/server/src/serverMonolith.ts:739`
- Profile update endpoint:
  - `src/server/src/serverMonolith.ts:764`

## C) Backend storage design (Postgres)

### Migration conventions and runner
- Migration folder and naming style:
  - `src/server/migrations/*.js`
  - latest existing: `1770383500000_add_user_profile_fields.js`
- Runner:
  - `src/server/package.json:16` (`"migrate": "node-pg-migrate"`)
- Pattern:
  - `exports.up = (pgm) => { ... }`
  - `exports.down = (pgm) => { ... }`
  - example: `src/server/migrations/1770383000000_add_saved_interfaces.js:14`

### Proposed migration filename
- `src/server/migrations/1770384000000_add_feedback_messages.js`

### Proposed table shape
- `feedback_messages`
  - `id bigserial primary key`
  - `user_id bigint not null references users(id) on delete cascade`
  - `category text not null default ''`
  - `message text not null`
  - `context_json jsonb not null default '{}'::jsonb`
  - `status text not null default 'new'`
  - `created_at timestamptz not null default now()`
- Recommended indexes for admin triage:
  - `(created_at desc)`
  - `(status, created_at desc)`
  - `(user_id, created_at desc)`
- Optional status guard:
  - check constraint: `status in ('new','triaged','done')`

### Admin allowlist pattern
- No existing admin allowlist/authz env pattern found in `src/server/src`.
- Minimal backend pattern to add:
  - `ADMIN_EMAIL_ALLOWLIST` (comma-separated)
  - fallback alias: `ADMIN_EMAILS`
- Enforce at backend endpoint level, not frontend-only.

## D) Backend API endpoints

### Existing style baseline
- Route style in monolith:
  - `app.post("/api/...", requireAuth, async (req, res) => { ... })`
  - example: `src/server/src/serverMonolith.ts:863`
- Logging style:
  - short operational logs without secret payloads.

### Proposed routes
- `POST /api/feedback` (requireAuth)
  - body: `{ category, message, context }`
  - writes one row to `feedback_messages`
  - logs only metadata:
    - user id, feedback id, category, message length, status
  - never log message text or `context_json` full body.
- `GET /api/feedback` (requireAuth + admin-only)
  - query: `limit`, `cursor` (or `before_id`)
  - returns newest first.
- `POST /api/feedback/update-status` (requireAuth + admin-only)
  - body: `{ id, status }`
  - status constrained to `new|triaged|done`.

### JSON parser limit check
- Global parser limit is 2mb:
  - `src/server/src/llm/limits.ts:2`
  - `src/server/src/serverMonolith.ts:74`
- Saved interfaces has separate 15mb parser:
  - `src/server/src/serverMonolith.ts:73`
- Feedback payload is small; global 2mb is sufficient.
- Recommendation: add length validation anyway (`message` max chars), fail 400 before DB insert.

## E) Frontend API helpers (`src/api.ts`)

### Existing helper pattern
- Shared helpers with credentials include:
  - `src/api.ts:49` (`apiGet`)
  - `src/api.ts:97` (`apiPost`)
  - `credentials: 'include'` at `src/api.ts:58` and `src/api.ts:107`
- Existing typed wrappers:
  - `listSavedInterfaces`: `src/api.ts:206`
  - `upsertSavedInterface`: `src/api.ts:218`
  - `updateProfile`: `src/api.ts:254`

### Recommended new helper signatures
- `submitFeedback(input: { category: string; message: string; context?: Record<string, unknown> }): Promise<{ ok: true; id: number }>`
- `listFeedbackAdmin(input?: { limit?: number; cursor?: number }): Promise<{ items: FeedbackAdminItem[]; nextCursor?: number }>`
- `updateFeedbackStatusAdmin(input: { id: number; status: "new" | "triaged" | "done" }): Promise<{ ok: true }>`

## F) Admin UI (ugly ok, sharp triage)

### Placement recommendation
- Keep one modal system in `AppShell`.
- Trigger path:
  - Sidebar Suggestion item calls AppShell callback instead of local log.
  - callback opens feedback modal.
- Admin inbox can be a tab/section inside the same feedback modal when user is admin.
  - minimal diff, single overlay stack, shared shielding and close logic.

### Minimal interaction model
- Modal layout:
  - Left list column: item preview (`category`, first ~80 chars, created timestamp, status badge).
  - Right detail panel: full message, context json (pretty print), status buttons.
- Triage buttons: `new`, `triaged`, `done`.
- Keyboard/close:
  - `Escape` closes modal.
  - click backdrop closes modal.
- Shielding:
  - reuse `hardShieldInput` pattern from AppShell overlays.
  - apply to backdrop, modal root, scroll containers, buttons, inputs.
  - no pointer or wheel leak to canvas.

## G) Must-pass acceptance gates

1. Logged-in user can submit feedback successfully.
2. Logged-out user cannot submit (UI blocked and backend 401).
3. Non-admin cannot list/update feedback (backend 403).
4. Admin list loads quickly, stable modal size, no horizontal scroll, only internal scrolling.
5. Canvas never reacts beneath feedback/admin overlays (pointer and wheel fully shielded).
6. Feedback persists in Postgres and reappears after reload in admin inbox.
7. Build passes:
   - root: `npm run build`
   - server: `cd src/server; npm run build`

## Recommended minimal-diff implementation plan

1. Sidebar hook-up:
   - Add `onOpenFeedback` prop to `Sidebar`.
   - Replace placeholder Suggestion click log with callback invocation.
2. AppShell modal ownership:
   - Add `isFeedbackOpen`, form state, submit state, admin-inbox state.
   - Reuse existing `hardShieldInput` and Escape/backdrop close pattern.
3. Backend authz utility:
   - Add `isAdminUser` helper in `serverMonolith.ts` based on `ADMIN_EMAIL_ALLOWLIST` and `res.locals.user.email`.
4. DB migration:
   - Add `1770384000000_add_feedback_messages.js` with table + indexes + status check.
5. Backend routes:
   - Add `POST /api/feedback` (requireAuth).
   - Add `GET /api/feedback` and `POST /api/feedback/update-status` (requireAuth + admin-only).
   - Validate payload sizes and status enum; log ids and lengths only.
6. Frontend API helpers:
   - Add `submitFeedback`, `listFeedbackAdmin`, `updateFeedbackStatusAdmin` in `src/api.ts`.
7. AppShell UI:
   - Add simple centered feedback modal.
   - If admin, show inbox pane and detail pane with status actions.
8. Verification:
   - Manual overlay shielding checks on graph canvas.
   - Role-path checks (logged out, user, admin).
   - Build checks for root and server.

## Risks to handle explicitly during implementation
- Admin auth bypass risk if frontend-only gating is used; backend must enforce.
- Message/context overlogging risk; keep logs metadata-only.
- Overlay pointer leakage risk; every interactive element needs propagation shields.
- Migration deployment ordering risk; run migration before enabling admin/read endpoints in production.
