# Repulsion Truth Scan - Forensic Report (2026-02-02)

## Executive Summary

**FINDING**: Repulsion is missing on screen in XPBD mode because `applyRepulsion()` is **never called** in the XPBD tick pipeline.

**ROOT CAUSE**: Mode isolation. The XPBD tick (`runPhysicsTickXPBD`) bypasses the force pass entirely, relying only on kinematic drag, integration, and XPBD edge constraints. Global repulsion exists in the codebase but is only invoked by the legacy tick (`runPhysicsTickLegacy`).

---

## A. Repulsion Implementation Locations

### A.1 Primary Implementation

**File**: `src/physics/forces.ts`  
**Function**: `applyRepulsion`  
**Line**: 8-286  
**Signature**:
```typescript
export function applyRepulsion(
    nodes: PhysicsNode[],
    activeNodes: PhysicsNode[],
    sleepingNodes: PhysicsNode[],
    config: ForceConfig,
    stats: any,
    energy?: number,
    pairStride: number = 1,
    pairOffset: number = 0,
    neighborCache?: Map<string, Set<string>>
)
```

**Inputs/Outputs**:
- **Reads**: `node.x`, `node.y`, `node.isFixed`, `node.listIndex`
- **Writes**: `node.fx`, `node.fy` (force accumulators)
- **Units**: World-space pixels (zoom-invariant)
- **Algorithm**: Brute-force O(N²) pairwise with strided sampling optimization

**Gates**:
1. **Distance gate**: `repulsionDistanceMax` (early exit if `d² > maxDistSq`)
2. **Stride gate**: `pairStride` parameter enables coverage reduction (e.g., stride=2 → 50% pairs)
3. **Sleep gate**: Sleeping nodes only interact with active nodes (not each other)
4. **Strength clamp**: `repulsionMaxForce` caps force magnitude
5. **Singularity guard**: Deterministic hash-based nudge when `dx ≈ 0, dy ≈ 0`

**Force Law**:
```
F = (k / d) * softening * densityBoost * pairStride
```
- Type: Inverse distance (1/r), NOT inverse-square
- Softening: Dynamic dead-core ramp from 0.1 at d=0 to 1.0 at d=softR
- Density boost: Only active during early expansion (legacy init strategy)

---

### A.2 Related Functions

**File**: `src/physics/forces.ts`  
**Function**: `applyCollision`  
**Line**: 288-367  
**Purpose**: Radius-based overlap resolution (similar to repulsion but uses `node.radius`)  
**Writes**: `node.fx`, `node.fy`

---

## B. Call Graph Analysis

### B.1 Entry Points

**Top-level dispatcher**:
- **File**: `src/physics/engine/engineTick.ts`
- **Function**: `runPhysicsTick` (Line 1018-1024)
- **Logic**:
  ```typescript
  if (engine.config.useXPBD) {
      runPhysicsTickXPBD(engine, dtIn);  // XPBD mode
  } else {
      runPhysicsTickLegacy(engine, dtIn); // Legacy mode
  }
  ```

---

### B.2 Legacy Tick Call Order (runPhysicsTickLegacy)

**File**: `src/physics/engine/engineTick.ts`  
**Function**: `runPhysicsTickLegacy` (Line 58-1014)

**Execution order**:
1. **Preflight** (`runTickPreflight`) - NaN/Inf checks
2. **Motion Policy** (`createMotionPolicy`) - Energy/degrade scalars
3. **Force Pass** (`applyForcePass`) ← **REPULSION CALLED HERE**
   - Line 640-663
   - Calls `applyRepulsion` at Line 192, 205, 220, 227 in `forcePass.ts`
4. **Velocity Mods** (`applyDragVelocity`, etc.)
5. **Integration** (`integrateNodes`) - Updates `node.x/y` from `node.vx/vy`
6. **Constraints** (`applySpacingConstraints`, `applyTriangleAreaConstraints`, etc.)
7. **Diffusion** (`applyCorrectionsWithDiffusion`) - Applies positional corrections
8. **Finalize** (`finalizePhysicsTick`)

**Force accumulation**:
- `applyForcePass` clears `node.fx/fy = 0` (Line 38 in `forcePass.ts`)
- `applyRepulsion` writes `node.fx += fx` (Line 261 in `forces.ts`)
- `applySprings` writes `node.fx += fx`
- `applyBoundaryForce` writes `node.fx += nx * force`

**Integration consumes forces**:
- `integrateNodes` reads `node.fx/fy` to compute acceleration (Line 201 in `integration.ts`)
- Updates velocity: `node.vx += ax * dt`
- Updates position: `node.x += node.vx * dt` (Line 188 in `integration.ts`)

---

### B.3 XPBD Tick Call Order (runPhysicsTickXPBD)

**File**: `src/physics/engine/engineTickXPBD.ts`  
**Function**: `runPhysicsTickXPBD` (Line 460-714)

**Execution order**:
1. **Preflight** (`runTickPreflight`)
2. **Constraint Rebuild** (`rebuildXPBDConstraints`) - If topology changed
3. **Time Policy** (`timePolicy.evaluate`)
4. **Velocity Mods** (`applyDragVelocity`) - **NO FORCE PASS**
5. **Integration** (`integrateNodes`) - Updates `node.x/y` from `node.vx/vy`
6. **Kinematic Drag** (`applyKinematicDrag`) - Snaps dragged node to cursor
7. **XPBD Solver** (`solveXPBDEdgeConstraints`) - Iterative distance constraints
8. **Reconcile** (`reconcileAfterXPBDConstraints`) - Syncs `prevX/prevY` with position corrections
9. **Finalize** (`finalizePhysicsTick`)

**CRITICAL ABSENCE**:
- **NO `applyForcePass` call**
- **NO `applyRepulsion` call**
- **NO force accumulation step**

**Position writers in XPBD**:
1. `integrateNodes` (Line 564-575): `node.x += node.vx * dt`
2. `applyKinematicDrag` (Line 579): `node.x = clampedTargetX` (dragged node only)
3. `solveXPBDEdgeConstraints` (Line 600): `nA.x += pxA` (constraint corrections)

---

## C. Proof: Why Repulsion is Missing on Screen in XPBD

### C.1 Direct Evidence

**Question**: Is `applyRepulsion` called in XPBD tick?  
**Answer**: **NO**

**Proof**:
```bash
# Search for applyRepulsion in XPBD tick file
rg "applyRepulsion" src/physics/engine/engineTickXPBD.ts
# Result: NO MATCHES
```

**Verification**:
- Viewed `engineTickXPBD.ts` (Lines 1-716): No `applyRepulsion` import or call
- Viewed `engineTick.ts` (Lines 1018-1024): Mode switch delegates to separate functions
- Confirmed `applyForcePass` is only called in `runPhysicsTickLegacy` (Line 640)

---

### C.2 Mode Isolation Explanation

**Architecture**: The codebase uses **mutually exclusive pipelines**:

| Pipeline | File | Repulsion? | Edge Constraints? |
|----------|------|------------|-------------------|
| **Legacy** | `engineTick.ts` (runPhysicsTickLegacy) | ✅ YES (via `applyForcePass`) | ❌ NO (uses springs) |
| **XPBD** | `engineTickXPBD.ts` (runPhysicsTickXPBD) | ❌ **NO** | ✅ YES (XPBD solver) |

**Current behavior**:
- When `engine.config.useXPBD = true`, the system routes to `runPhysicsTickXPBD`
- XPBD tick **skips the entire force pass** to avoid conflicts with position-based constraints
- Result: **Only edge-based separation** (topology-constrained), **no global repulsion**

**Observable symptoms** (matches user report):
- "Repulsion/spacing seems to happen for neighbor/linked dots" → XPBD edge constraints
- "Non-neighbor dots can overlap and pass through" → No global repulsion

---

## D. Write-Ownership Analysis

### D.1 Force Accumulators (`node.fx`, `node.fy`)

**Writers** (Legacy mode only):
1. `forcePass.ts:38` - **Clear**: `node.fx = 0`
2. `forces.ts:261` - **Repulsion**: `nodeA.fx += fx`
3. `forces.ts:568` - **Springs**: `source.fx += sfx`
4. `forces.ts:770` - **Center Gravity**: `node.fx += nx * force`
5. `forces.ts:807` - **Boundary**: `node.fx += penetration * strength`
6. `forcePass.ts:253` - **Drag Force**: `node.fx += dx * dragStrength`

**Readers**:
1. `integration.ts:201` - **Integration**: `accX = node.fx / mass`

**XPBD mode**: Forces are **never written** (no force pass), so `node.fx/fy` remain 0.

---

### D.2 Positions (`node.x`, `node.y`)

**Writers** (both modes):

| Writer | File:Line | Context | Mode |
|--------|-----------|---------|------|
| **Integration** | `integration.ts:188` | `node.x += node.vx * dt` | Both |
| **Kinematic Drag** | `engineTickXPBD.ts:50` | `node.x = clampedTargetX` | XPBD only |
| **XPBD Solver** | `engineTickXPBD.ts:388` | `nA.x += pxA` | XPBD only |
| **Diffusion** | `corrections.ts:353,431,496` | `node.x += corrDx` | Legacy only |
| **Preflight Rollback** | `engineTickPreflight.ts:83,88` | `node.x = lastGoodX` (NaN guard) | Both |
| **Fixed Leak Guard** | `engineTick.ts:962` | `node.x = snap.x` (validation) | Legacy only |

**Last writer before render** (XPBD mode):
- **XPBD Solver** (`solveXPBDEdgeConstraints`) writes final positional corrections
- **Reconcile** (`reconcileAfterXPBDConstraints`) syncs `prevX/prevY` but does NOT write `x/y`

**Last writer before render** (Legacy mode):
- **Diffusion** (`applyCorrectionsWithDiffusion`) applies constraint corrections

---

### D.3 Velocities (`node.vx`, `node.vy`, `node.prevX/prevY`)

**Writers**:
1. `integration.ts:165` - **Base Integration**: `node.vx += ax * dt` (from forces)
2. `integration.ts:174` - **Damping**: `node.vx *= dampFactor`
3. `engineTickXPBD.ts:56` - **Kinematic Drag**: `node.vx = (x - oldX) / dt`
4. `engineTickXPBD.ts:196` - **Reconcile**: `node.prevX += dx` (history sync)

**Key insight**: In XPBD mode, velocity is **derived from position changes**, not from forces.

---

### D.4 Insertion Seam for Repulsion in XPBD

**Where repulsion MUST be inserted** to affect final `x/y`:

**Option 1: Force-based (requires integration)**
- **Location**: Before `integrateNodes` in `engineTickXPBD.ts` (around Line 564)
- **Mechanism**: Call `applyRepulsion` to write `node.fx/fy`, then integration converts to velocity/position
- **Pros**: Reuses existing repulsion logic
- **Cons**: Mixes force-based and position-based paradigms

**Option 2: Position-based (XPBD-native)**
- **Location**: Inside `solveXPBDEdgeConstraints` or as separate constraint pass
- **Mechanism**: Implement repulsion as XPBD inequality constraints (C = d - minDist ≥ 0)
- **Pros**: Pure XPBD, no force/integration coupling
- **Cons**: Requires new constraint solver logic

**Option 3: Hybrid (force pass before integration)**
- **Location**: After `applyDragVelocity`, before `integrateNodes` (Line 561-563)
- **Mechanism**: Add minimal force pass (repulsion only, no springs)
- **Pros**: Minimal code change, clear separation
- **Cons**: Still mixes paradigms

---

## E. Next Insertion Seam Candidates

### Candidate 1: Minimal Force Pass (RECOMMENDED)

**File**: `src/physics/engine/engineTickXPBD.ts`  
**Location**: Line 561-563 (before `integrateNodes`)  
**Implementation**:
```typescript
// NEW: XPBD Repulsion (Force-Based)
if (engine.config.xpbdRepulsionEnabled) {
    // Clear forces
    for (const node of nodeList) {
        node.fx = 0;
        node.fy = 0;
    }
    // Apply repulsion
    applyRepulsion(
        nodeList,
        activeNodes,
        sleepingNodes,
        engine.config,
        stats,
        undefined, // energy (not used in XPBD)
        1, // pairStride (full coverage for now)
        0, // pairOffset
        engine.neighborCache
    );
}
```

**Pros**:
- Minimal code change (~10 lines)
- Reuses existing `applyRepulsion` logic
- Clear toggle (`xpbdRepulsionEnabled`)

**Cons**:
- Mixes force-based repulsion with position-based constraints
- May need tuning for XPBD compliance interaction

---

### Candidate 2: XPBD Repulsion Constraints

**File**: `src/physics/engine/engineTickXPBD.ts`  
**Location**: After `solveXPBDEdgeConstraints` (Line 600)  
**Implementation**: New function `solveXPBDRepulsionConstraints`
- Inequality constraints: `C = d - minDist ≥ 0`
- Only apply corrections when `d < minDist`
- Use compliance for soft repulsion

**Pros**:
- Pure XPBD paradigm
- No force/integration coupling

**Cons**:
- Requires new solver logic (~100 lines)
- O(N²) complexity needs spatial hash for large N

---

### Candidate 3: Hybrid Pre-Integration Pass

**File**: `src/physics/engine/engineTickXPBD.ts`  
**Location**: Line 561 (create new `applyXPBDForcePass` function)  
**Implementation**: Separate force pass with only repulsion + boundary
- Skip springs (handled by XPBD constraints)
- Keep repulsion force-based for simplicity

**Pros**:
- Clean separation of concerns
- Easy to toggle/debug

**Cons**:
- Code duplication with legacy `applyForcePass`

---

## F. Conclusion

**Repulsion is missing because**:
1. XPBD mode uses a separate tick function (`runPhysicsTickXPBD`)
2. This function **never calls `applyForcePass`**
3. `applyRepulsion` is **only invoked** by `applyForcePass`
4. Therefore, repulsion **never executes** in XPBD mode

**Write ownership chain**:
- Legacy: `applyRepulsion` → `node.fx` → `integration` → `node.x`
- XPBD: ❌ (no repulsion) → `integration` → `node.x` → `XPBD solver` → `node.x`

**Next steps**:
1. Add HUD counters to confirm repulsion execution status
2. Choose insertion seam (recommend Candidate 1 for MVP)
3. Implement with O(N²) mitigation (spatial hash for N > 100)
4. Verify no XPBD constraint conflicts

---

## G. File + Line Anchors Reference

### Repulsion Implementation
- `src/physics/forces.ts:8-286` - `applyRepulsion` function
- `src/physics/forces.ts:271-279` - Main pairwise loop
- `src/physics/forces.ts:245` - Force law equation
- `src/physics/forces.ts:261-266` - Force accumulation (`node.fx += fx`)

### Call Sites (Legacy Only)
- `src/physics/engine/forcePass.ts:3` - Import statement
- `src/physics/engine/forcePass.ts:192` - Call site 1 (main pass)
- `src/physics/engine/forcePass.ts:205` - Call site 2 (focus boost)
- `src/physics/engine/forcePass.ts:220` - Call site 3 (no timing)
- `src/physics/engine/forcePass.ts:227` - Call site 4 (focus boost, no timing)

### Tick Entry Points
- `src/physics/engine/engineTick.ts:1018-1024` - Mode dispatcher
- `src/physics/engine/engineTick.ts:58-1014` - `runPhysicsTickLegacy`
- `src/physics/engine/engineTickXPBD.ts:460-714` - `runPhysicsTickXPBD`

### Write Ownership
- `src/physics/engine/integration.ts:188` - Position update (`node.x += vx * dt`)
- `src/physics/engine/integration.ts:201` - Force to acceleration (`accX = fx / mass`)
- `src/physics/engine/engineTickXPBD.ts:388` - XPBD position correction (`nA.x += pxA`)
- `src/physics/engine/engineTickXPBD.ts:50` - Kinematic drag (`node.x = target`)

### Insertion Seam Candidates
- `src/physics/engine/engineTickXPBD.ts:561-563` - Before integration (Candidate 1)
- `src/physics/engine/engineTickXPBD.ts:600` - After edge solver (Candidate 2)
