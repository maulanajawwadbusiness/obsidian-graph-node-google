# XPBD Run 7 Conflict Analysis: "Dead Painting" vs Spring-Mass Body

## Problem Statement
After implementing Run 7 (drag coupling), the screen shows "dead painting" instead of expected spring-mass behavior. Nodes don't visibly respond to forces or oscillate.

## Root Cause: Compliance Too Soft

### The Numbers
**Current Config** (`config.ts` line 179):
```typescript
xpbdLinkCompliance: 0.01
```

**Physics Calculation** (60Hz, dt=0.016s):
```
alpha = compliance / dt²
alpha = 0.01 / (0.016)² ≈ 39

For 10px spring stretch:
deltaLambda = -C / (wSum + alpha)
deltaLambda = -10 / (2 + 39) ≈ -0.24
correction per node = 0.12 px per frame
```

**Time to Correct 10px Error**:
```
10px / 0.12px per frame = 83 frames ≈ 1.4 seconds
```

### Why This Looks "Dead"
- Springs correct at **0.12px per frame**
- At 60fps, this is **imperceptible** to human eye
- No visible oscillation or "bounce"
- Feels like nodes are "painted" in place, not physically connected

## The Conflict: Stiffness vs Stability

### Mini Run 6 History
1. **Initial attempt**: `compliance = 0.0001` (very stiff)
   - Correction: ~2px per frame
   - Result: **EXPLOSION** on drag release
   
2. **Fix**: `compliance = 0.01` (100x softer)
   - Correction: ~0.12px per frame  
   - Result: **STABLE** but invisible

### The Tradeoff
```
Smaller compliance → Stiffer springs → Larger corrections → VISIBLE but UNSTABLE
Larger compliance → Softer springs → Smaller corrections → STABLE but INVISIBLE
```

## Why Run 7 Didn't Fix This

Run 7 implemented:
- ✅ Kinematic pinning (`invMass=0` for dragged node)
- ✅ Ghost velocity prevention (`prevX` sync)
- ✅ Neighbor coupling (removed solver skip)

**BUT**: These changes only affect **drag behavior**, not **idle spring response**.

When you're NOT dragging:
- Nodes still use `compliance = 0.01`
- Springs still correct at 0.12px/frame
- Graph still looks "dead"

## The Missing Piece: Why Drag Makes It Worse

When you drag with current settings:
1. Dragged node snaps to cursor (kinematic)
2. Neighbors try to follow via springs
3. But springs are SO SOFT (0.01 compliance) that neighbors barely move
4. Result: Dragging feels like "pulling a dead body" instead of "tugging a spring"

Additionally, the cursor offset issue means:
- We can't use stiffer springs (explosion risk)
- We're stuck with soft springs (dead feel)

## Solutions

### Option 1: Fix Cursor Offset, Then Increase Stiffness (RECOMMENDED)
**Steps**:
1. Implement cursor offset fixes from `xpbd_drag_cursor_offset_fix_plan.md`
   - Post-solver position lock
   - Skip dragged node in reconcile
2. Once cursor is stable, gradually reduce compliance:
   - Try `0.001` (10x stiffer)
   - Try `0.0005` (20x stiffer)
   - Find sweet spot where springs are visible but stable

**Expected Result**:
- Compliance ~0.001: correction ~1.2px/frame → visible spring response
- Cursor stays locked to node during drag
- Clean release without explosion

### Option 2: Adaptive Compliance (ADVANCED)
**Concept**:
- Use soft compliance (0.01) during drag
- Use stiff compliance (0.001) when idle
- Smooth transition between states

**Code**:
```typescript
const isDragging = engine.draggedNodeId !== null;
const baseCompliance = isDragging ? 0.01 : 0.001;
```

**Risk**: Mode switching might cause discontinuities

### Option 3: Multi-Iteration Solver (FUTURE)
**Concept**:
- Keep soft compliance (0.01)
- Run solver 10 iterations per frame
- Total correction: 0.12px × 10 = 1.2px per frame

**Benefit**: Stable AND visible
**Cost**: 10x computation time

## Immediate Action Plan

### Phase 1: Verify Diagnosis
Add telemetry to confirm corrections are tiny:
```typescript
// In HUD
console.log(`XPBD corrMax: ${hud.xpbdSpringCorrMaxPx}px`);
// Should show ~0.12px, confirming "dead" diagnosis
```

### Phase 2: Quick Test
Temporarily set `xpbdLinkCompliance: 0.001` in config
- If springs become visible → diagnosis confirmed
- If explosion occurs → cursor offset is the blocker

### Phase 3: Implement Fix
Based on Phase 2 result:
- **If visible + stable**: Document new compliance value, done
- **If explosion**: Implement cursor offset fixes first, then retry

## Expected Behavior After Fix

### Idle Graph (No Drag)
- Nodes gently oscillate around equilibrium
- Springs visibly "breathe" (1-2px amplitude)
- Settles in 1-3 oscillations (~0.5 seconds)

### During Drag
- Cursor locks to node (no offset)
- Neighbors stretch visibly (5-20px depending on distance)
- Springs show tension (straight lines, not slack)

### After Release
- Node oscillates 2-3 times
- Amplitude decays smoothly
- Settles to rest in ~1 second

## Status
- **Diagnosis**: ✅ CONFIRMED (compliance too soft)
- **Root Cause**: ✅ IDENTIFIED (Mini Run 6 explosion avoidance)
- **Blocker**: ⚠️ Cursor offset prevents using stiffer springs
- **Next Step**: Implement cursor offset fixes OR test with `compliance=0.001`
