# Step 4 Lease-Loss Bug Fix Run 5: Epoch-Gated Reacquire for Mounted Preview

Date: 2026-02-15
Scope: allow paused/denied preview to reacquire safely without polling.

## File changed

- `src/components/SampleGraphPreview.tsx`

## Added logic

1. Reacquire guards
- `leaseStateRef` tracks latest lease phase for subscription callback.
- `lastReacquireEpochRef` prevents repeated attempts in same lease epoch.

2. Subscription behavior
- On each lease snapshot update:
  - if preview has token and token inactive -> force pause and clear token.
  - if preview has no token and phase is `paused/denied/checking`:
    - only try reacquire once per epoch
    - skip reacquire while `activeOwner === graph-screen`

3. Reacquire outcomes
- success -> set `allowed` and token ref
- deny -> set explicit `denied` state

## Safety characteristics

- no intervals/timeouts
- no busy loops
- strictly event-driven by lease snapshot updates