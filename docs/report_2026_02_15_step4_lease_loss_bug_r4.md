# Step 4 Lease-Loss Bug Fix Run 4: Preview Self-Enforcing Lease Ownership

Date: 2026-02-15
Scope: force preview runtime stop when preview loses active lease token.

## File changed

- `src/components/SampleGraphPreview.tsx`

## State machine updates

- Lease states now include:
  - `checking`
  - `allowed { token }`
  - `denied { activeOwner, activeInstanceId }`
  - `paused { reason: lost_lease | denied }`

## Enforcement logic added

1. On acquire success:
- store token in `activeLeaseTokenRef`
- set `leaseState=allowed`

2. Subscribe to lease updates:
- uses `subscribeGraphRuntimeLease(...)`
- when token ref exists and `isGraphRuntimeLeaseTokenActive(token)` is false:
  - set state to `paused(lost_lease)`
  - clear token ref

3. Mount gate remains strict:
- runtime mounts only when `leaseState.phase === 'allowed'` and payload/portal are ready.
- if paused, runtime is not mounted.

## UI behavior

- New paused fallback on lease loss:
  - `preview paused (graph active elsewhere)`

## Result

- already-mounted preview runtime now self-unmounts when lease ownership is lost.