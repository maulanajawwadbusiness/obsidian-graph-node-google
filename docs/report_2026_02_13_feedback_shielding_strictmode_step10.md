# Feedback Overlay Listener Inventory (Step 10 Run 1)

## AppShell listener inventory
- `window keydown (capture)`:
  - delete confirm close
  - profile close
  - logout confirm close
  - feedback close (Escape blocked while submit pending)
- `window online`:
  - remote outbox drain wake
- `window wheel (capture, passive=false)`:
  - onboarding scroll lock path

## Sidebar listener inventory
- `window pointerdown (capture)` + `keydown (capture)`:
  - row menu outside-close + Escape
  - avatar menu outside-close + Escape
  - more menu outside-close + Escape
- `window resize/scroll`:
  - anchored menu placement updates
- `window pointermove { once: true }`:
  - close-hover arming path

## Timer inventory
- feedback auto-close timer after submit success
- admin soft refresh debounce timer
- remote outbox drain timer
- onboarding overlay timeout path

## Duplicate-prevention guards
- feedback modal open session refs (`feedbackOpenSessionRef`, `isFeedbackOpenRef`)
- admin refresh in-flight ref (`adminRefreshInFlightRef`)
- triage per-item pending lock (`adminStatusPendingById`)
- outbox drain lock (`remoteOutboxDrainingRef`)

## Cleanup strategy
- listener effects remove with same handler reference in cleanup
- modal/timer cleanup on close and unmount
- stale async apply guarded by modal-open/session refs before state writes
