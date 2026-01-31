# Forensic Report Phase 5: Render Seam Crash Trap

## Evidence
- **SEEN**: `Loop Check` (Line 997).
- **NOT SEEN**: `Gate` (Line 369, called at Line 1001).
- **Deduction**: Execution dies between Line 997 and 1001.
- **Suspect**: Line 1000 `renderScratch.prepare(engine, visibleBounds)`.

## Trap Deployed
I have wrapped `renderScratch.prepare` in a `try-catch` block.
I added "Seam Probe" logs (Pre/Post Prepare) that execute unconditionally every 1s.

## Expected Outcome
1.  **If Crash**: Console will show `[HoverDbg] CRITICAL CRASH ...`.
    - This means `renderScratch` or `spatialGrid` has a bug (e.g. `grid` is null, `nodes` undefined).
2.  **If No Crash**: We see "Post-Prepare (Success)".
    - This means `prepare` finished, and execution continued to `updateHoverSelectionIfNeeded`.
    - If `Gate` still missing, then `updateHoverSelectionIfNeeded` call itself is the issue (e.g. shadowed function?).

## Hypotheses on Crash
- `visibleBounds` contains NaN?
- `engine` is null?
- `renderScratch.hitGrid` not initialized?
