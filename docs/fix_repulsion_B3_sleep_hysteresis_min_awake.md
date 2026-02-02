# Fix Repulsion B3: Soften Sleep Gating

**Date**: 2026-02-02
**Goal**: Allow the engine to "rest" without killing the repulsion field entirely, maintaining responsiveness.

## Problem
In `finalizePhysicsTick`, when `hudSettleState` reached `'sleep'`, ALL nodes were forcibly zeroed and set to `isSleeping=true`.
This meant that unless a drag event occurred (which acts as an external force), the internal physics loop (repulsion) was completely bypassed because `activeNodes` was empty.
Combined with B1 (which fixes the empty list issue), we still need the *engine state* to allow these nodes to be "awake" in the eyes of the integration step.

## Fix
In `src/physics/engine/engineTickFinalize.ts`:
- **Modified Sleep Transition**: When entering `sleep` state:
  - Check `xpbdRepulsionEnabled`.
  - If true, preserve a **Quota of 2 Nodes** (the first 2, matching B1's sentries) as "awake".
  - These sentries are heavily damped (`0.9x` velocity per frame) to prevent jitter, but `isSleeping` is kept `false`.
  - All other nodes go to full sleep (velocity 0).

This creates a "Pulse" or "Heartbeat" where the engine technically says "I am sleeping (mostly)", but the physics loop still sees 2 active nodes, runs the repulsion check, and if those nodes are pushed by a new force (e.g. user toggles repulsion strength), they react, potentially waking others.

## Hysteresis Note
The existing code already had a 120-frame counter (`node.sleepFrames > 120`) before suggesting sleep. The B3 fix ensures that *even after* this threshold is crossed and the global state becomes 'sleep', we don't hard-kill the entire simulation.

## Verification
- **Idle State**: HUD should show `Active: 2` (or similar small number) and `Sleep: N-2`.
- **Repulsion Checks**: `Pairs Checked` should remain > 0 even when "Settle: sleep" is displayed.
- **Responsiveness**: Toggling "XPBD Repel" off/on during sleep should immediately wake nodes if they overlap (because the sentries will feel the force).

## Deliverables Summary
- **B1**: No zero active (Safety floor)
- **B2**: Drag wakes bubble
- **B3**: Minimum-awake pulse during sleep

Fixed the "Bucket B" failures: Repulsion now has valid participation at all times.
