# Forensic Report Phase 4: Render Loop Partial Execution

## Evidence
- **SEEN**: `[HoverDbg] Input Active` (Input Handler runs).
- **SEEN**: `[HoverDbg] Loop Check` (Render Loop runs *at least to Line 996*).
- **NOT SEEN**: `[HoverDbg] Gate` (Inserted block never runs).

## Code Structure Analysis
Based on `graphRenderingLoop.ts` (Viewed in Step 496):

```typescript
993: const project = ...
994: const worldToScreen = project;
995: const visibleBounds = transform.getVisibleBounds(200);
996: if (theme.hoverDebugEnabled && Math.random() < 0.01) {
997:     console.log(`[HoverDbg] Loop Check ...`); // <--- SEEN
998: }
999:
1000: renderScratch.prepare(engine, visibleBounds);
```

### The Missing Gate Log
I applied a patch (Step 495) to insert `[HoverDbg] Gate` *before* `renderScratch.prepare`.
If `Loop Check` prints but `Gate` (unconditional) does NOT, then:
1.  **Placement Error**: Did I insert `Gate` *after* a crash?
2.  **Overwrite Error**: Did the `replace_file_content` fail silently or apply to the wrong location?
3.  **Crash**: Does code between Line 997 and `Gate` crash?

### Location Verification
In Step 495, I targeted:
```typescript
<<<<
    // P1: Loop Gate Probe (Unconditional, Throttled 1Hz)
    // FIX: Removing debug flag blindness to prove loop execution
    if (now - (hoverStateRef.current as any).lastGateLog > 1000) { ... }
====
```
But `Loop Check` is at Line 996.
Where is `Gate`?
It seems `Gate` was inserted *earlier* in the file?
Wait, Step 495 replacement shows context:
```typescript
    // Heartbeat: Force reliable 10Hz updates even if input loop is stalled
    const heartbeat = timeSinceLast > 100;
       <-- Inserted Gate Here
    // We bypass throttling if Env Changed (Must be correct instantly)
    if (shouldRun || heartbeat) { ... }
```
This block is inside `updateHoverSelectionIfNeeded` (implied context) or inside `render`?
Ah! `graphRenderingLoop.ts` has `startGraphRenderLoop` AND `updateHoverSelectionIfNeeded` (Wait, is it a separate function?).

**CRITICAL REALIZATION**:
`updateHoverSelectionIfNeeded` might be a **standalone function defined OUTSIDE `render()`**.
If `render()` calls `updateHoverSelectionIfNeeded`, and `Gate` is inside `updateHoverSelectionIfNeeded`...
Then `render()` is running, but `updateHoverSelectionIfNeeded` is NOT being called?
OR it is called, but crashes before `Gate`?

### The Call Chain
`render()` calls `updateHoverSelectionIfNeeded(...)`.
If `Loop Check` (Line 997) is seen, and `renderScratch.prepare` (Line 1000) follows...
Where is `updateHoverSelectionIfNeeded` called?
It is likely called *after* `renderScratch.prepare`.

If `Gate` is inside `updateHoverSelectionIfNeeded`, and `Gate` never prints, then **`updateHoverSelectionIfNeeded` is never called**.

Why?
Let's check `render()` bottom logic.

## Hypothesis
`updateHoverSelectionIfNeeded` call is missing or commented out in `render()`.
Or `render()` crashes at `renderScratch.prepare`, so execution never reaches `updateHoverSelectionIfNeeded`.

## Verification Plan
1.  Check `graphRenderingLoop.ts` lines 1000+.
2.  Confirm `updateHoverSelectionIfNeeded` is actually called.
