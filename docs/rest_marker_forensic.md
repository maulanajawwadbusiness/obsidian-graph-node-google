# Rest Marker Forensic Report

## Summary
To investigate why rest state markers are not appearing, I have added lightweight forensic instrumentation to the Physics HUD and a "Force Show" debug toggle. 

**Update (Fix 1):** The initial implementation of "Force Show" was not visible because the state wiring in the parent component (`GraphPhysicsPlayground.tsx`) was missing. This has been rectified, and diagnostic visuals have been enhanced.

## New Debug Capabilities

### 1. Physics HUD Section: "Rest Marker Forensic"
When "Show Rest Markers" is enabled in the Debug panel, a new section appears in the overlaid HUD:

*   **Enabled**: Confirms the feature flag is on.
*   **DrawPass**: `YES` confirms the `drawNodes` loop is attempting to draw markers (verifies function reachability).
*   **LastDraw**: Time (ms) since the last draw attempt (verifies render loop Hz).
*   **Candidates**: Count of nodes that pass the "sleep eligibility" check (sleeping or sleepFrames > 0).
*   **Sleeping**: Count of nodes actually in `node.isSleeping` state.
*   **JitterWarn**: Count of nodes that *should* be resting but are moving too fast (exceeding jitter threshold).
*   **Eps**: The velocity threshold used (default ~0.01).
*   **SampleSpd**: Measurements of node velocity (root mean square of current candidate).

### 2. Force Show Toggle
A new checkbox **"[Debug] Force Show Markers"** has been added to the Debug panel (under Feel Markers).
*   **Action**: Bypasses the velocity/sleep checks and draws rest markers on *all* eligible candidates, and even forces them on non-candidates if needed.
*   **Visual Confirmation**:
    *   **Big Red Text**: "FORCE SHOW REST MARKERS ACTIVE" appears at the top left of the canvas.
    *   **Big Dots**: Markers are drawn larger (radius 4px minimum) to ensure they are not missed.
*   **Use Case**: 
    - If markers appear when this is checked: The rendering code (color, coords, layer) is fine; the issue is the logic predicate.
    - If markers DO NOT appear when checked: The issue is rendering (z-index, off-screen, transparent, etc.).

## How to Test
1.  Open **Debug** panel.
2.  Enable **Calculated > Show Rest Markers**.
3.  Check **[Debug] Force Show Markers**.
    *   **Verify**: Red text "FORCE SHOW REST MARKERS ACTIVE" appears.
    *   **Verify**: Large dots appear under every node (Orange = Moving, Blue = Resting).
4.  Uncheck "Force Show" and observe normal behavior using the HUD stats.

## Root Cause Logic
The current logic (in `graphDraw.ts`) for drawing a rest marker is:

```typescript
const restCandidate = engine.hudSettleState === 'sleep' || node.isSleeping === true || (node.sleepFrames ?? 0) > 0;
// AND
const isFakeRest = speedSq > jitterWarnSq;
const isTrueRest = speedSq <= restSpeedSq;
// DRAW IF:
(restCandidate) && (isFakeRest || isTrueRest)
```

The "Force Show" overrides this to always draw, using an orange color if the node is effectively moving (fake rest) and blue if truly resting.
