# Forensic Report: Settle State Ladder Fights

## 1. The Contradiction (Ladder Fight)

Previously, two systems fought for control of the "Settle State":

1.  **Motion Policy (Physics Brain):**
    *   Calculates `settleScalar` based on global `avgVelSq`.
    *   Threshold: `avgVelSq < 0.01`.
    *   Result: Only gates injectors. Does not force "Sleep".

2.  **HUD Snapshot (Display):**
    *   Calculates `isMoving` based on `avgVelSq > 0.25` (Huge!).
    *   Result: Display showed "Moving" long after physics considered it "Settled".
    *   Result: `sleep` state was unreachable because it required `idleFrames > 10`, which required `settleScalar > 0.99`, but HUD logic overrode it with `moving` if one node was fast? Actually HUD logic was loose, but inconsistent.

## 2. The Fix: Unified Truth

We unified the state machine into a single writer at the end of `engineTick`:

```typescript
// FIX: Unified Settle State (Truthful)
const sleepRatio = fRestCandidates / totalNodes;

let newState = 'moving';
if (sleepRatio >= 0.99) { // 1% outliers allowed
    newState = 'sleep';
} else if (sleepRatio > 0.5 || (motionPolicy.settleScalar > 0.8)) {
    newState = 'cooling';
}
```

## 3. Improvements

1.  **Outlier Tolerance (1%):**
    *   Previously, 1 fast node (e.g. glitch) would prevent global sleep.
    *   Now, if 99% of nodes are effectively sleeping (based on local adaptive rest), the system enters `sleep` state. The remaining 1% are clamped/stopped by the global state transition anyway.

2.  **Explicit Blockers (HUD):**
    *   Added `settleBlockers` to HUD to show *exactly* why we aren't sleeping.
    *   List includes: `Speed xN`, `Force xN`, `Pressure xN` (Constraint fights).
    *   If "Settle: Moving" persists, the HUD lists `Pressure x5` -> means 5 nodes are fighting constraints.

3.  **Monotonic Ladder:**
    *   State progresses `Moving -> Cooling -> Sleep`.
    *   Cooling is a broad "catch-all" for "mostly settled".
    *   Sleep is the final destination.

## 4. Verification Protocol (Expected)

1.  **Hands-Off Test:**
    *   Watch `settleBlockers`.
    *   Initially `Speed x20`.
    *   Then `Speed` drops, maybe `Pressure` lingers.
    *   Finally `settleState` -> `sleep`.

2.  **Dense Cluster:**
    *   Metrics might show `Pressure` fluctuating.
    *   If `outlierCount` drops below 1%, global sleep triggers.
