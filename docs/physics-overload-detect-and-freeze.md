# Physics Overload Failure Mode: Hard Freeze

## 1. The Strategy
**"Better to Freeze than to Syrup."**
When the system is overwhelmed, we do not attempt to "catch up" (which causes slow motion). We:
1.  **Detect** the overload state.
2.  **Harmonic Freeze**: Skip physics for 1 frame.
3.  **Drop Debt**: Discard the accumulated time.
4.  **Resume**: On the next frame, we start fresh at 1:1 speed.

## 2. Overload Triggers
The system enters **HARD FALIURE MODE** if:
1.  **Huge Delta**: `dt > 200ms` (Tab switch, GC pause).
2.  **Persistent Debt (Slush)**: `accumulator > 2 * fixedStep` for `>= 2` consecutive frames.

If either condition is met:
- `freezeTriggered = true`
- `stepsThisFrame = 0` (No physics ticks)
- `accumulatorMs = 0` (All time debt deleted)

## 3. Interaction Safety
The pointer/hover logic runs **outside** the physics loop.
- **Drag**: Dragging a node works purely on render coordinates and raycasting.
- **Result**: Even if physics freezes, the dragged node stays pinned to the cursor (Hand Authority), preserving the "alive" feel even if the simulation background stutters.

## 4. Verification Logs
When overload triggers, you will see explicit logs:
```
[Overload] active=true severity=HARD reason=DT_HUGE freezeTriggered=true freezeCount=1 droppedMs=205.0
```
or
```
[Overload] active=true severity=HARD reason=PERSISTENT_DEBT freezeTriggered=true ...
```

## 5. Manual Test
1.  Enable `debugStall: true` in `config.ts`.
2.  This forces a ~50ms stall per frame (simulating heavy load).
3.  **Behavior**: The graph will animate at a low frame rate (stuttery), but **velocities will remain correct** (no slow motion).
4.  **Console**: You should see `[Overload] ... reason=PERSISTENT_DEBT` logs verifying the freeze logic is engaging to clear the backlog.
