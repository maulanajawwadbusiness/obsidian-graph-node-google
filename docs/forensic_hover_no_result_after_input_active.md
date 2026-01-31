# Forensic Report: Hover Input Active, No Result

## Symptom
`[HoverDbg] Input Active` is visible (input reaches handler), but `hover:` logs are missing.
This implies the pipeline breaks AFTER input handling but BEFORE result reporting.

## Probes Deployed

### P1: Loop Gate (graphRenderingLoop.ts)
Logs `pending`, `hasPointer`, `env`, `heartbeat`, and `refId`.
- **Purpose**: Prove the loop actually sees the `pending` flag set by the handler.
- **Fail Condition**: If `pending` stays false despite Input logs, we have a **Ref Identity Mismatch** (handler writes to Ref A, loop reads Ref B).

### P2: Call Probe (graphRenderingLoop.ts)
Logs just before `updateHoverSelection` is called.
- **Purpose**: Prove the `if (hasPointer)` guard is passed.

### P3: Entry Probe (hoverController.ts)
Logs at start of `updateHoverSelection`.
- **Purpose**: Prove the callback itself is wired to the correct instance.

### P5: Result Probe (hoverController.ts)
Logs hit test results deterministically (every 1s or on change).
- **Purpose**: Prove hit test is running but perhaps returning 0 candidates (Case D).

## Expected Pattern for Success
1.  `Input Active` sets `pending=true`.
2.  `Gate` shows `pending=true` (or `heartbeat=true`).
3.  `Call updateHoverSelection` fires.
4.  `Enter updateHoverSelection` fires.
5.  `hover:` logs result (even if `null`).

## Hypotheses
1.  **Ref Identity Mismatch**: Highly probable if input logs show pending but gate shows false.
2.  **Hit Grid Empty**: If `hover:` logs appear but show `dist=Infinity` / `decision=exited` constantly, the hit grid is failing to populate or coordinate mapping is wrong.

## Next Step
Observe logs.
- If Ref IDs differ -> Fix `useGraphRendering`.
- If Gate fails -> Fix Ref passing.
- If Results show miss -> Fix `SpatialGrid` / Coordinate Math.
