# XPBD Drag Cursor Offset - Root Cause Analysis & Fix Plan

## Problem Statement
After enabling solver for dragged node constraints (removing the skip), cursor position becomes less precise during drag. When dragging a node far from its rest position, the cursor begins to offset from the node position.

## Root Cause Analysis

### Current Drag Flow
1. **Pre-Solver Injection** (lines 546-571): `draggedNode.x/y = dragTarget.x/y`
2. **Solver Phase** (line 584): `solveXPBDEdgeConstraints(engine, dt)`
3. **Reconcile Phase** (line 598): `reconcileAfterXPBDConstraints(...)`

### Identified Edge Cases

#### 1. **Solver Correction Overwrites Kinematic Position**
**Severity**: HIGH  
**Mechanism**:
- We set `draggedNode.x = dragTarget.x` BEFORE solver (line 552)
- Solver runs with `invMass=0` for dragged node
- BUT: If there's a bug in the solver or reconcile, the dragged node position might still be modified
- Even with `invMass=0`, numerical precision issues or correction accumulation could cause drift

**Evidence**:
- Line 598: `reconcileAfterXPBDConstraints` adjusts `prevX/prevY` based on `(x - preSolveSnapshot)`
- If solver accidentally moves dragged node (even 0.001px due to floating point), reconcile will sync `prevX`, creating cumulative drift

**Fix Priority**: P0

#### 2. **Reconcile Phase Modifies Dragged Node History**
**Severity**: MEDIUM  
**Mechanism**:
- Lines 560-564: We manually sync `prevX = x` for dragged node
- Line 598: `reconcileAfterXPBDConstraints` runs AFTER solver
- Reconcile function (not shown here) likely does:
  ```typescript
  const dx = node.x - preSolveSnapshot[i*2+0];
  node.prevX += dx;
  ```
- For dragged node, this is redundant with our manual sync and could cause double-adjustment

**Fix Priority**: P1

#### 3. **Multi-Constraint Accumulation**
**Severity**: MEDIUM  
**Mechanism**:
- Dragged node with N neighbors has N constraints
- Each constraint calculates error based on current `draggedNode.x`
- If solver runs iteratively or if there's any position update between constraints, errors accumulate
- Example: Node has 5 springs, each pulling with 10px error = 50px total "pull force" that might leak through `invMass=0` barrier due to numerical issues

**Fix Priority**: P1

#### 4. **Frame Timing / Multiple Ticks Per Frame**
**Severity**: LOW  
**Mechanism**:
- If physics ticks multiple times per render frame, `dragTarget` might be stale
- First tick: `draggedNode.x = dragTarget.x` (correct)
- Second tick (same frame): `dragTarget` unchanged, but node might have drifted from solver
- Result: Cursor appears offset because we're seeing the position AFTER multiple ticks

**Fix Priority**: P2

#### 5. **Floating Point Precision Loss**
**Severity**: LOW  
**Mechanism**:
- Large drag distances (e.g., 1000px) combined with small dt (0.016s)
- Velocity calculations: `v = (x - prevX) / dt` with large numerators
- Correction calculations with `invMass=0` might have division-by-epsilon issues
- Cumulative rounding errors over many frames

**Fix Priority**: P3

#### 6. **Constraint Order Dependency**
**Severity**: LOW  
**Mechanism**:
- Constraints are solved in array order
- If dragged node is involved in constraint[0], it gets processed first
- Later constraints see the "corrected" position of neighbors, which might indirectly affect dragged node through shared neighbors
- Example: A-drag-B-C chain, solving A-B first might affect B, then B-C affects B again, creating feedback

**Fix Priority**: P3

## Proposed Fix Plan

### Phase 1: Immediate Fixes (P0)

#### Fix 1.1: Post-Solver Position Lock
**Location**: After line 584 (after `solveXPBDEdgeConstraints`)
**Code**:
```typescript
// CRITICAL: Re-lock dragged node position after solver
// Even with invMass=0, numerical drift can occur
if (engine.draggedNodeId && engine.dragTarget) {
    const draggedNode = engine.nodes.get(engine.draggedNodeId);
    if (draggedNode) {
        draggedNode.x = engine.dragTarget.x;
        draggedNode.y = engine.dragTarget.y;
    }
}
```

#### Fix 1.2: Skip Dragged Node in Reconcile
**Location**: Inside `reconcileAfterXPBDConstraints` function
**Code**:
```typescript
for (let i = 0; i < nodeList.length; i++) {
    const node = nodeList[i];
    
    // Skip dragged node - we manually manage its history
    if (node.id === engine.draggedNodeId) continue;
    
    // ... rest of reconcile logic
}
```

### Phase 2: Robustness (P1)

#### Fix 2.1: Telemetry for Drift Detection
**Location**: After post-solver lock
**Code**:
```typescript
if (engine.xpbdFrameAccum && draggedNode) {
    const driftX = Math.abs(draggedNode.x - engine.dragTarget.x);
    const driftY = Math.abs(draggedNode.y - engine.dragTarget.y);
    const drift = Math.sqrt(driftX * driftX + driftY * driftY);
    engine.xpbdFrameAccum.springs.dragDriftPx = Math.max(
        engine.xpbdFrameAccum.springs.dragDriftPx || 0,
        drift
    );
}
```

#### Fix 2.2: Constraint Correction Cap for Dragged Neighbors
**Location**: Inside solver, after calculating `deltaLambda`
**Code**:
```typescript
// If either endpoint is dragged, cap the correction to prevent accumulation
if (isDraggedA || isDraggedB) {
    const MAX_DRAG_NEIGHBOR_CORR = 50; // px per constraint
    if (Math.abs(deltaLambda) > MAX_DRAG_NEIGHBOR_CORR) {
        deltaLambda = Math.sign(deltaLambda) * MAX_DRAG_NEIGHBOR_CORR;
    }
}
```

### Phase 3: Advanced (P2-P3)

#### Fix 3.1: Drag Target Interpolation
**Location**: Pre-solver injection
**Concept**: Instead of snapping to `dragTarget`, lerp over multiple frames to smooth out large jumps
**Status**: DEFERRED (conflicts with "knife-sharp" requirement)

#### Fix 3.2: Constraint Reordering
**Location**: `rebuildXPBDConstraints`
**Concept**: Sort constraints so dragged-node constraints are processed last
**Status**: RESEARCH NEEDED

#### Fix 3.3: Multi-Tick Detection
**Location**: Top of `runPhysicsTickXPBD`
**Concept**: Detect if `dragTarget` has changed since last tick; if not, skip re-injection
**Status**: RESEARCH NEEDED

## Verification Plan

### Test Cases
1. **Slow Drag**: Move node 100px over 2 seconds → cursor should stay locked
2. **Fast Drag**: Move node 500px in 0.5 seconds → max drift < 1px
3. **Dense Cluster**: Drag node with 10+ neighbors → no position jump
4. **Sparse Graph**: Drag isolated node with 1 neighbor → perfect tracking

### Telemetry
- `dragDriftPx`: Max drift per frame (should be < 0.1px)
- `dragCorrectionsCapped`: Count of capped corrections
- `dragReconcileSkips`: Count of reconcile skips for dragged node

## Implementation Order
1. ✅ Fix 1.1: Post-solver position lock (CRITICAL)
2. ✅ Fix 1.2: Skip dragged node in reconcile
3. ⏳ Fix 2.1: Add drift telemetry
4. ⏳ Fix 2.2: Cap neighbor corrections (if drift persists)
5. 🔬 Research Phase 3 fixes if needed

## Status
- **Current**: Documented edge cases
- **Next**: Implement Phase 1 fixes
- **Target**: < 0.5px cursor drift under all conditions
