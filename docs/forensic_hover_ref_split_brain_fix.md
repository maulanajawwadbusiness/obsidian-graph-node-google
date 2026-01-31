# Forensic Report Phase 7: Split Brain Architecture Fix

## Diagnosis
The disparity between "Input Active" (pending=true) and "Gate" (pending=false) confirms that the Input Handler and Render Loop are bound to different Reference instances (`Split Brain`).
This implies the component (or hook) re-created its refs (Remount/Re-render), starting a new Loop B, but the user is observing logs from Loop A (Stale), or vice versa.

## Fix Implemented
1.  **Identity Stamping**: Added unique `LOOP_ID` to each render loop instance.
2.  **Lifecycle Logging**: logging `Start Loop ${LOOP_ID}` and `Stop Loop ${LOOP_ID}`.
    - If we see "Start Loop A", then "Start Loop B" WITHOUT "Stop Loop A", we have a leak (Double Loop).
    - If we see "Stop Loop A" then "Start Loop B", but logs show mismatch, then Input Handler is somehow bound to A while B is running? (Unlikely if handlers are replaced on render).
3.  **Ref ID Correlation**: Added `refId` to "Input Active" logs. Now we can match:
    - Input Log: `refId=ptr-123`
    - Loop Log: `refId=ptr-456`
    - If they differ, the Split Brain is visually confirmed.

## Theoretical Cause
React `useEffect` cleanup failing to fire or `cancelAnimationFrame` failing to stop the specific loop instance (closing over wrong frameId?).
We used a stable variable for `frameId` inside the closure, so it should work.
However, if `startGraphRenderLoop` is called TWICE (Strict Mode) and the first cleanup is delayed or missed, we get two loops.

## Next Steps
Monitor console for:
`[HoverDbg] Start Loop loop-123 refId=ptr-ABC`
`[HoverDbg] Stop Loop loop-123`
`[HoverDbg] Input Active ... refId=ptr-XYZ`

If `ABC != XYZ`, the input is talking to a zombie/alien loop.
