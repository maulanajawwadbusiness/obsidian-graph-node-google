# Feedback Admin Inbox Refresh Step 9

## Scope
- Frontend refresh behavior only in `src/screens/AppShell.tsx`.
- Modal remains AppShell-owned and fixed-size.

## Refresh Modes
- Hard refresh:
  - clears list/cursor/selection first
  - fetches first page (`limit=50`)
  - replaces list and selects first item when available
- Soft refresh:
  - fetches first page only
  - updates existing rows by id without reordering existing list
  - prepends new ids at the top
  - keeps selection stable when selected id still exists

## Debounce Behavior
- After successful status update, soft refresh is scheduled with debounce (`600ms`).
- Repeated status clicks coalesce into one soft refresh request.

## Pending-lock Merge Rule
- During soft merge, if an item has pending status update (`adminStatusPendingById[id] === true`),
  its local optimistic `status` is preserved and not overwritten by refresh payload.

## Refresh Policy
- Stale threshold: 30 seconds.
- On open:
  - avoids redundant refetch if admin list is already loaded and fresh.
- On switch to Inbox tab:
  - hard refresh when list is empty
  - soft refresh only when stale

## Selection Stability
- If selected item still exists after refresh, selection is kept.
- If selected item disappears, selection falls back to first item.
- If list becomes empty, selection becomes null.

## Safety Notes
- No feedback message/context payload is logged.
- Refresh controls and inbox interactive surfaces remain shielded to prevent canvas input leakage.
