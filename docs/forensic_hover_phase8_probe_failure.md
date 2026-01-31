# Forensic Report Phase 8: Probe Failure & Lifecycle Confirmation

## Evidence Analysis (from Logs)
1.  **Lifecycle Integrity Confirmed**:
    - `Start Loop loop-8764`
    - `Stop Loop loop-8764`
    - `Start Loop loop-488`
    - **Conclusion**: The loop restart logic is working correctly. There are **no Zombie Loops**. The old loop stops before the new one starts (or shortly after).

2.  **Ref Stability Confirmed**:
    - Loop 8764 sees `refId=hvr-384`.
    - Loop 488 sees `refId=hvr-384`.
    - **Conclusion**: The `hoverStateRef` object is **stable** across the restart. The component did NOT remount cleanly (which would generate new IDs), but likely re-ran the Effect due to dependency change. This **rules out** the "Split Brain via Remount" hypothesis.

3.  **Probe Malfunction Identified**:
    - `Input Active` log shows `refId=undefined`.
    - `Gate` log is completely missing.
    - **Root Cause**:
        - **Input Log**: The probe code tries to access `.__debugId` on `hoverStateRef.current`. The ID was attached to the `ref` container itself, not the current value. Hence `undefined`.
        - **Gate Log**: The probe code logic `now - lastGateLog > 1000` evaluates to `false` because `lastGateLog` is initially `undefined`. `number - undefined` is `NaN`. `NaN > 1000` is false.

## Diagnostic Dead End
Because the diagnostics themselves are buggy, we cannot currently see:
1.  Whether the Input Log sees the same `refId` (`hvr-384`) as the Loop. (Though highly likely given stability).
2.  Whether the Loop sees `pending=true` at the Gate.

## Functional State
- Hover is still reported "dead".
- We know `renderScratch.prepare` succeeds (Phase 5).
- We know Loop is running (Loop Check).
- We know Input is active.

## Recommended Fix (Next Step)
We must repair the forensic probes to proceed.
1.  Fix Gate Log logic: `(lastGateLog || 0)`.
2.  Fix Input Log Ref access: `(hoverStateRef as any).__debugId`.
