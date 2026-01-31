# Rest Marker Forensic Report

## Summary
Rest markers were previously invisible due to two factors:
1.  **State Wiring**: The "Force Show" toggle was not connected to the renderer. (Fixed)
2.  **Logic Predicate**: The `restCandidate` condition was never met because `sleepFrames` were not being updated in the engine. (Fixed)

We have restored full functionality using the "One Continuous Law" doctrine.

## The Law of Rest

A node is considered "Resting" if:
1.  **MotionPolicy**: `speedSq < MotionPolicy.restSpeedSq` (0.01^2).
2.  **Duration**: This condition persists for `MotionPolicy.restFramesRequired` (60 ticks / 1s).
3.  **Fallback**: As a robustness measure, any node moving slower than `jitterWarnSq` is immediately considered a "Candidate" for visualization (fallback path).

## Debug Capabilities

### 1. Physics HUD Section: "Rest Marker Forensic"
When "Show Rest Markers" is enabled, the overlaid HUD shows:
*   **Enabled**: Feature flag status.
*   **DrawPass**: Verifies renderer reachability.
*   **Candidates**: Count of nodes considered for rest visualization.
    *   *Correction*: This should now be >0 as long as nodes are slow.
*   **Sleeping**: Count of nodes that have satisfied the valid 1s rest duration.
*   **SampleSpd**: RMS velocity of candidates.

### 2. Force Show Toggle
Overrides all logic to force markers to appear.
*   **Red Text**: "FORCE SHOW REST MARKERS ACTIVE"
*   **Big Dots**: Radius 4px minimum.

## Implementation Details

### Engine Tick (`engineTick.ts`)
A canonical sleep detection loop was added at the end of every physics tick:
```typescript
const restSpeedSq = motionPolicy.restSpeedSq;
const restFramesRequired = motionPolicy.restFramesRequired;
for (const node of nodeList) {
    if (node.fixed || dragged) { 
        node.sleepFrames = 0; 
        continue; 
    }
    if (speedSq < restSpeedSq) {
        node.sleepFrames++;
        if (node.sleepFrames >= restFramesRequired) node.isSleeping = true;
    } else {
        node.sleepFrames = 0;
        node.isSleeping = false;
    }
}
```

### Renderer (`graphDraw.ts`)
The selection predicate now includes a fallback:
```typescript
const restCandidate = engine.hudSettleState === 'sleep' 
    || node.isSleeping 
    || node.sleepFrames > 0
    || speedSq < jitterWarnSq; // Fallback
```

## Tuning
Thresholds are defined in `src/physics/engine/motionPolicy.ts`:
*   `restSpeedSq`: Currently 0.0001
*   `restFramesRequired`: Currently 60
