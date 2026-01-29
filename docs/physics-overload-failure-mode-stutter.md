# Physics Overload Failure Mode: Stutter (Drop Debt)

## 1. The Contract
**"Brief Stutter, Never Syrup."**
When the application framing falls behind (e.g., garbage collection, heavy UI blocking, or background tab throttling), the physics simulation must **skip time** rather than **stretch time**.

- **Forbidden**: "Syrup" / Slow Motion. Accumulating time debt and processing it over multiple subsequent frames, causing the simulation to run slower than wall-clock time.
- **Enforced**: "Stutter". Dropping the excess time debt immediately. The object teleports/skips the missed timeframe, maintaining strictly 1:1 speed with wall-clock time.

## 2. Implementation Validation

### A. Debt Drop Logic
In `useGraphRendering.ts`:
```typescript
const debtLimit = fixedStepMs; 
if (accumulatorMs >= debtLimit) {
    droppedMs += accumulatorMs;
    dropReason = "OVERLOAD";
    accumulatorMs = 0; // HARD RESET
}
```
If the physics loop hits the `maxStepsPerFrame` cap (def: 2) and still has debt remaining (>16ms), we purely discard it. 
**Result**: The simulation ticks 32ms (2 steps), but if 100ms passed in the real world, we drop the remaining 68ms. The visual result is a 32ms movement followed by a 68ms "jump" in time (where nothing happens), re-syncing instantly to the present.

### B. Slush Detection
We added a `[PhysicsSlushWarn]` detector.
If `accumulatorMs` remains `> 2 * fixedStepMs` for more than 2 consecutive frames, it implies the system is dangerously behind (spiral risk). The system now force-validates the drop logic to ensure this never persists.

### C. Logging
Explicit logs are emitted when overload drops occur:
```
[RenderPerf] droppedMs=84.0 reason=OVERLOAD budgetMs=33.3 ticksThisFrame=2 avgTickMs=...
```

## 3. How to Verify (Manual Overload Test)
A debug flag `debugStall` has been added to `ForceConfig` in `types.ts` and `config.ts`.

1.  Open `src/physics/config.ts`.
2.  Set `debugStall: true` in `DEFAULT_PHYSICS_CONFIG` (or add it):
    ```typescript
    export const DEFAULT_PHYSICS_CONFIG: ForceConfig = {
        // ...
        debugStall: true,
        // ...
    };
    ```
3.  Run the app. This injects a ~50ms busy-wait loop into the render thread.
4.  **Observe**:
    - The graph should feel "choppy" (low FPS) but **sharp**. 
    - When you drag a node, it should stay under your cursor (with visual jumps) rather than drifting behind like a rubber band (syrup).
    - Console should show `reason=OVERLOAD` logs.

## 4. Safety
The `accumulatorMs` is hard-reset to `0` on overload. This guarantees that `accumulatorMs` can never grow indefinitely, preventing the "Death Spiral" where the physics engine tries to simulate 10 seconds of physics in a 16ms frame.
