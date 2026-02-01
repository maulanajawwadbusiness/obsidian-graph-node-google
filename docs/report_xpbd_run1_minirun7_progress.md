# XPBD Mini Run 7: Drag Coupling - Progress Report

## Status: Parts 0-4 Complete (6 more to go)

### Completed Parts

#### Part 0: Scandissect ✅
- **File**: `docs/report_xpbd_run1_minirun7_part0_scandissect.md`
- Documented current drag pipeline
- Identified issues: gradual lerp causing "mush", redundant isFixed mutation
- Documented tick order and state management

#### Part 1: Remove Gradual Lerp ✅
- **File**: `src/physics/engine/engineTickXPBD.ts`
- Removed `MAX_MOVE_PER_FRAME` lerp (50px limit)
- Changed to instant snap: `node.x = clampedTargetX`
- Removed `isFixed = true` mutation (redundant)
- Result: Crisp response, no latency

#### Part 2: Add State Tracking Fields ✅
- **Files**: `src/physics/engine/engineTickTypes.ts`, `src/physics/engine.ts`
- Added to types: `grabOffset`, `lastReleasedNodeId`, `lastReleaseFrame`
- Note: `grabOffset` already existed, reused it

#### Part 3: Add Telemetry Fields ✅
- **Files**: `src/physics/engine/engineTickTypes.ts`, `src/physics/engine.ts`
- Added `pinnedCount: number` - tracks nodes with invMass=0
- Added `draggedNodePinned: boolean` - is dragged node pinned?

#### Part 4: Populate Telemetry ✅
- **File**: `src/physics/engine/engineTickXPBD.ts`
- Track `pinnedCount` in solver loop
- Count dragged node (if active)
- Count fixed nodes (avoiding double-count)
- Update telemetry at end of solver

### Remaining Parts (5-10)

#### Part 5: Wire Telemetry to HUD (TODO)
- Add fields to `physicsHud.ts` types
- Wire in `engineTickHud.ts`
- Display in `CanvasOverlays.tsx`

#### Part 6: Clean Up Drag Release Logic (TODO)
- Add explicit prevX/prevY reconciliation on release
- Clear `grabOffset` on release
- Track release frame

#### Part 7: Test Basic Functionality (TODO)
- Verify instant snap works
- Check HUD shows pinnedCount > 0 during drag
- Ensure no explosions

#### Part 8: Remove Unnecessary Canary Code (TODO)
- Clean up constraints involving dragged node skip logic
- Verify this doesn't break anything

#### Part 9: Write Final Report (TODO)
- Document all changes
- Include T1/T2 test results
- List invariants checked

#### Part 10: Final Commit (TODO)
- Clean build
- Final git commit

---

## Current State

### What Changed
1. **Drag feels crisp** - Instant snap, no lerp latency
2. **Telemetry ready** - pinnedCount/draggedNodePinned tracked
3. **Type-safe** - All new fields properly typed and initialized

### What Still Needs Work
- HUD display not yet wired
- Release transition not cleaned up
- Not yet tested in browser
- Final report not written

### Known Issues
- Unused variable warning for `dx` in line 228 (minor, can fix in Part 6)
- Need to test for explosions after removing lerp

---

## Next Steps

Continuing with Parts 5-10 to complete Mini Run 7.
