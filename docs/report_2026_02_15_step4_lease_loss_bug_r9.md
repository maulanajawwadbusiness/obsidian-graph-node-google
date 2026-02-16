# Step 4 Lease-Loss Bug Fix Run 9: Docs + Verification Checklist

Date: 2026-02-15
Scope: document self-enforcing lease model and verification routine.

## File updated

- `docs/system.md`

## Documentation additions

1. Lease snapshot/subscription/token-active APIs documented.
2. Lease-loss unmount contract documented for `SampleGraphPreview`.
3. Defensive graph boundary reacquire behavior documented.
4. Debug counters/log expectations documented.

## Manual verification checklist now covers

1. prompt preview acquires and mounts.
2. graph transition preempts prompt lease.
3. preview self-pauses/unmounts if it loses token while still mounted.
4. rapid toggles do not allow zombie preview runtime alongside active graph owner.