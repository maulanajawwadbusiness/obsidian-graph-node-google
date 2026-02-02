# Fix Repulsion B1: No Zero Active

**Date**: 2026-02-02
**Goal**: Prevent "All Asleep" collapse where global repulsion silently disables itself.

## Problem
If all nodes settle and go to sleep (`isSleeping=true`), `activeNodes` becomes empty.
`applyRepulsion` iterates:
1. Active vs Active pair (0 loops)
2. Active vs Sleeping pair (0 loops)
Result: Repulsion logic is skipped entirely. Even if a new node is added or config changes, nothing happens until something randomly wakes up.

## Fix
In `src/physics/engine/engineTickXPBD.ts`, added a **Repulsion Safety Floor**:
- If `activeNodes.length === 0` AND `nodeList.length >= 2`:
  - Force wake the first 2 nodes (`nodeList[0]` and `nodeList[1]`).
  - Set `isSleeping = false`.
  - Re-run the active/sleeping split.

This ensures there are always at least 2 "sentries" patrolling the force field.
- If they overlap, they will generate force → wake neighbors → chain reaction.
- If they don't overlap, they stay awake as low-cost monitors.

## Verification
- **HUD**: `Active` count in "Repulsion Proof" section should never drop below 2 (if N>=2).
- **Behavior**: If you spawn nodes and let them settle, the last 2 will stay awake (or iterate if the sentries rotate, but current logic is deterministic index 0,1).
- **Repulsion Pairs**: Will stay non-zero (checking the sentry pair).

## Risks
- Minimal CPU cost (keeping 2 nodes awake is negligible).
- "Sentry" nodes might jitter slightly if they are unstable, but settled nodes should be calm.

## Next Steps (B2)
- Ensure "Drag" wakes a larger bubble so interaction feels responsive immediately.
