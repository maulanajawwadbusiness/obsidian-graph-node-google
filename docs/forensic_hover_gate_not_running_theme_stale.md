# Forensic Report Phase 3: Loop Debug Blindness Removed

## Symptom
`[HoverDbg] Input Active` logs appeared, but `Gate` logs were missing despite `[HoverDbg] Loop Check` being visible occasionally.
Hypothesis: The loop execution path for the Gate Log was guarded by a flag (`theme.hoverDebugEnabled`) that was evaluating to `false` inside the loop, possibly due to stale closure capture or incorrect reading.

## Fix Implemented
1.  **Unconditional Gate Probe**: Removed the `if (theme.hoverDebugEnabled)` check from the P1 Gate Probe.
    - Now logs every 1 second regardless of theme state.
    - Also logs `themeDbg` value to confirm if the loop sees the correct flag.
    - Also logs `refId` to confirm identity.

2.  **Unconditional Call Probe**: Removed the check from the P2 Call Probe.
    - If `updateHoverSelection` is called, it WILL log (throttled).

3.  **Per-Frame Theme Read**:
    - Verified that `const theme = getTheme(settingsRef.current.skinMode);` exists inside the `render()` function (Line 892).
    - This suggests theme *should* be fresh, but the log will confirm it.

## Verification
- **Expectation**: `[HoverDbg] Gate` MUST now appear in the console (throttled).
- **If Gate says `pending=true`**: The wiring is correct, and `Call updateHoverSelection` should follow.
- **If Gate says `pending=false`**: The `pendingPointerRef` identity is mismatching (check `refId` in log).
- **If Gate says `themeDbg=false`**: The `settingsRef` is stale or the theme config is not updating.

Hover input pipeline is now fully instrumented/ungated.
