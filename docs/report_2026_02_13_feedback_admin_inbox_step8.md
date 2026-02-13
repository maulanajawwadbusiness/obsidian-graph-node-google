# Feedback Admin Inbox UI Step 8

## Scope
- Frontend only in `src/screens/AppShell.tsx`.
- Admin inbox is rendered inside the same feedback modal.
- No notifications, no email, no push.

## Admin Gating Rule
- Backend remains source of truth via allowlist and admin-only routes.
- Frontend probes admin access through `GET /api/feedback`.
- If backend returns 403/401, UI falls back to normal user "Send feedback" flow.

## Endpoints Used
- `GET /api/feedback` for inbox list.
- `POST /api/feedback/update-status` for triage status updates.

## Pagination Strategy
- Uses backend `beforeId` cursor.
- Initial load uses limit 50.
- "Load more" appends results locally with id dedupe.

## Status Actions
- Detail pane shows actions: `new`, `triaged`, `done`.
- Optimistic update first, then API call.
- On failure, status is reverted and a small inline error is shown.
- Per-item pending lock prevents double-submit.

## Modal/Shielding Notes
- Modal size is fixed; list/detail use internal scrolling.
- No horizontal scrollbar in inbox surfaces.
- Backdrop, list/detail panes, rows, buttons, and controls are shielded so canvas does not react under overlay.

## Must-pass Checklist
- Non-admin sees send-only feedback UI.
- Admin sees inbox view by default and can switch to send view.
- Selecting a row updates detail panel.
- Load more appends older items.
- Status update applies optimistically and reverts on failure.
- No message/context payload is logged to console.
