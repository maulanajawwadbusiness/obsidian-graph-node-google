# Drag Gating Run 2: Disable Sleep

## Goal
Force the sleep system OFF during drag interactions to ensure the graph remains responsive ("User is god").

## Changes
1.  **Engine Context**: Added `dragActive` boolean.
2.  **Firewall Logic**: 
    - In `engineTick.ts`, `dragActive` is set to true if `draggedNodeId` exists.
    - Sleep classification loop now ignores `node.isSleeping` if `dragActive` is true.
    - Fixed nodes remain sleeping (optimization safety).

## Expected Behavior
- **While Dragging**: All dynamic nodes wake up. `nodesAwake` HUD count ~ equals Total Nodes (minus fixed). `nodesSleeping` ~ equals Fixed count.
- **After Release**: `dragActive` becomes false. Nodes allowed to sleep again according to `integration.ts` logic.

## Safety
- **Perf**: Waking all nodes forces O(N^2) repulsion checks (or O(N log N) if BH). For N=100 this is fine. For N=1000 it might be heavy, but "User Interaction" priority > "Battery Life".
- **Fixed Nodes**: Kept sleeping to prevent static-static interactions.

## Next Steps
- Run 3: Disable Degrade Throttling (Coverage Gating) during drag.
