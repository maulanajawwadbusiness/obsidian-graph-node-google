# Repulsion Default Status Check

**Goal**: Ensure repulsion WORKS by default (not just toggleable).

## Current Config Status
- `useXPBD: true` ✅
- `xpbdRepulsionEnabled: true` ✅
- `debugDisableRepulsion`: NOT SET (undefined → defaults to false, meaning repulsion enabled) ✅

## XPBD Tick Path
File: `src/physics/engine/engineTickXPBD.ts`
- Line 576: `if (engine.config.xpbdRepulsionEnabled)` ✅
- This block calls `applyRepulsion()` ✅

## Potential Blockers to Check
1. ❓ Are there any other flags that could disable repulsion?
2. ❓ Is `applyRepulsion` actually applying forces?
3. ❓ Are repulsion config values (strength, distance) set correctly?

## Action Items
- [ ] Verify no other blocking flags exist
- [ ] Check repulsion strength/distance values are reasonable
- [ ] Ensure forces are actually being applied to nodes
