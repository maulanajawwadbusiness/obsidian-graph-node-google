# Fix Repulsion B2: Drag Wakes Bubble

**Date**: 2026-02-02
**Goal**: Ensure that dragging a node immediately wakes it and its neighbors, guaranteeing repulsion eligibility during interaction.

## Problem
Even with B1 (global safety floor), a specific dragged node might be asleep (or its neighbors asleep), causing it to clip through other nodes "ghostly" until they wake up randomly. 

## Fix
In `src/physics/engine/engineTickXPBD.ts` (inside the `xpbdRepulsionEnabled` block):
- Checks `engine.draggedNodeId`.
- **Wakes Dragged Node**: Sets `isSleeping=false` and adds to `activeNodes`.
- **Wakes Topological Neighbors**: All 1-hop connected nodes are woken.
- **Wakes Spatial Neighbors**: All nodes within `1.5 * repulsionDistanceMax` are woken.

This ensures that the "bubble" around the cursor is always physically active, reacting to the forced movement immediately.

## Verification
- **Drag**: When dragging a node into a sleeping cluster, the cluster should "wake up" and repel *before* contact, or at least *upon* contact, rather than allowing deep penetration.
- **HUD**: `Active` count should jump significantly during drag (e.g. 2 -> 5 or 6) if dragging near others.
- **Pairs**: `Pairs Checked` should rise as the bubble expands.

## Risks
- Duplicates in `activeNodes` if we don't clean `sleepingNodes`.
  - *Mitigation*: The physics loops handle duplicates safely (idempotent force accumulation or index checks). We accept minor double-processing for one frame to avoid complex set management in the critical loop. Next frame cleanliness is restored by the fresh split.

## Next Steps (B3)
- Make sleep entry harder (hysteresis) so they don't fall asleep instantly after the drag ends.
