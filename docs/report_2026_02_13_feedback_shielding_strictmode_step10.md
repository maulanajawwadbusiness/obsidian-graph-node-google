# Feedback Overlay Listener Inventory (Step 10)

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

## Shielding surfaces checklist
- feedback backdrop + modal root
- feedback send textarea + buttons
- admin inbox split containers (list pane + detail pane)
- admin list rows + refresh + load more
- admin triage buttons + context panel
- all modal wheel paths use stopPropagation via `hardShieldInput`

## StrictMode invariants
- every `addEventListener` has matching cleanup with same handler reference
- async admin updates/fetches check modal-open/session/identity refs before state apply
- modal close, identity switch, and unmount clear refresh debounce timers
- refresh operations use in-flight guard to prevent overlap
- triage and submit are guarded against double actions while pending

## Quick manual test script
1. On graph screen open feedback modal and spam wheel/drag/click: graph does not move.
2. Open and close feedback modal 20 times: no accumulating lag/leaks.
3. In dev strictmode submit feedback once: exactly one created row.
4. As admin triage many rows quickly: no duplicate updates and statuses stay consistent.
5. Toggle offline/online and switch identity: no stale refresh applies into wrong session.
