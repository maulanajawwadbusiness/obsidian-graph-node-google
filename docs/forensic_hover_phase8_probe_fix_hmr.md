# Forensic Report Phase 8: Probe Repair & HMR Logic

## Findings
1.  **Probe Failure**: The missing `Gate` logs were caused by a logic error in the probe itself: `now - undefined > 1000` evaluates to `false`. Fixing this with `|| 0` ensures the log prints.
2.  **Ref ID Undefined**: The Input log showed `refId=undefined` because I incorrectly accessed `.current.__debugId` instead of the ref container `.__debugId`. Fixing this will reveal the true ID.
3.  **Lifecycle Confirmation**: Logs show `Start Loop 8764` -> `Stop Loop 8764` -> `Start Loop 488`. This confirms:
    - Cleanup is working (Zombie Loop theory weakened).
    - HMR/Restart is working.
    - Refs (hvr-384) are STABLE across restart (Component did not unmount/remount, just Effect restart or HMR patch?).

## New Hypothesis: Event Listener Closure Staleness
If Refs are stable (`hvr-384` in both loops), then **Split Brain is unlikely** in terms of "Different Ref Objects".
However, `pending=false` in Loop vs `pending=true` in Input is still a contradiction.
Possibilities:
1.  **Input Handler Stale**: Is the DOM listener bound to an OLD version of `handlePointerMove` that closes over an OLD Ref?
    - If Refs are stable (created once via useRef), the closure captures the SAME Ref object. `useRef` matches.
2.  **Pending Cleared Too Fast**: Is `pending` cleared somewhere I missed?
3.  **HMR State**: If Hot Module Reloading replaced `hoverController.ts` code, but React kept the old `useRef` state...
    - The new code might be checking the new Ref logic?
    - But `useRef` persists.

## Next Step
After applying the probe fixes, observe:
- **Gate Log**: Should finally appear. Check `pending` value.
- **refId**: Should match in both Input and Gate logs.
- **Gate Decision**: If `pending=true`, but Result Log missing -> Call Probe checks.

The fix to `|| 0` is applied. Waiting for user confirmation of logs.
