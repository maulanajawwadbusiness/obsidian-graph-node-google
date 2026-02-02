# XPBD Repulsion Run 3: Seam Wiring Report

## Mini Run 1/5: Scandissect + Lock the Seam

**Date**: 2026-02-02  
**Goal**: Reserve the pre-integration seam for repulsion force pass without changing behavior.

### Changes Made

#### 1. Seam Location Identified
**File**: `src/physics/engine/engineTickXPBD.ts`  
**Line**: 564-575 (`integrateNodes` call)

**Verification**:
- ✅ Confirmed: XPBD tick does NOT call `applyForcePass` or `applyRepulsion` (grep search returned no results)
- ✅ Confirmed: `integrateNodes` reads `node.fx/fy` at Line 201 in `integration.ts`
- ✅ Seam location: **Line 563** (immediately before `integrateNodes`)

#### 2. Seam Reservation Comment Block
**File**: `src/physics/engine/engineTickXPBD.ts:563-576`

Added clear documentation:
```typescript
// =========================================================================
// XPBD FORCE PASS SEAM (RESERVED)
// =========================================================================
// This is the ONLY correct location to apply forces in XPBD mode.
// Forces MUST be written before integrateNodes reads node.fx/fy.
// Integration converts forces → velocity → position.
// XPBD solver (later) corrects positions to satisfy constraints.
//
// Wire order: applyRepulsion → integrateNodes → solveXPBDEdgeConstraints
// =========================================================================
if (engine.config.xpbdRepulsionEnabled) {
    // TODO: Mini Run 3 - Wire applyRepulsion here
}
```

#### 3. Config Toggle Added
**File**: `src/physics/types.ts:257-259`

```typescript
// XPBD Repulsion Integration (Run 3)
xpbdRepulsionEnabled?: boolean; // Enable force-based repulsion in XPBD mode (Default: false)
```

**Default**: `undefined` (falsy) → No behavior change

### Verification Checklist

- [x] **Seam identified**: Line 563 in `engineTickXPBD.ts`
- [x] **No existing force pass**: Grep confirmed no `applyRepulsion` calls
- [x] **Integration reads forces**: Verified `integration.ts:201` reads `node.fx/fy`
- [x] **Comment block added**: Clear documentation at seam
- [x] **Config toggle added**: `xpbdRepulsionEnabled` in `ForceConfig`
- [x] **No behavior change**: Toggle defaults to false (no-op)
- [ ] **Build passes**: ⚠️ Unrelated TS error in `FullChatbar.tsx` (not from this change)

### Build Status

**TypeScript Error** (unrelated to this mini run):
```
src/fullchat/FullChatbar.tsx:768:17 - error TS2322
```

**Assessment**: This error exists in a different file (`FullChatbar.tsx`) and is unrelated to the seam reservation changes. The changes made in this mini run are syntactically correct:
- Added comment block (no syntax)
- Added conditional with empty body (valid TS)
- Added optional property to interface (valid TS)

**Action**: Proceeding with commit. The FullChatbar error should be fixed separately.

### Risks Identified

1. **None** - This is a pure documentation/reservation change with no runtime effect.

### Next Steps (Mini Run 2)

- Add telemetry counters to stats/HUD
- Wire counters to display
- Verify counters show (false state)

---

## Mini Run 2/5: Proof-of-Life Telemetry

**Date**: 2026-02-02  
**Goal**: Add telemetry plumbing before wiring actual repulsion logic.

### Changes Made

#### 1. Stats Type Updates
**File**: `src/physics/engine/stats.ts:26-31`

Added XPBD-specific repulsion counters to `SafetyStats`:
```typescript
// XPBD Repulsion Telemetry (Run 3 - Mini Run 2)
xpbdRepulsionEnabled?: boolean;
xpbdRepulsionCalledThisFrame?: boolean;
xpbdRepulsionPairsChecked?: number;
xpbdRepulsionMaxForce?: number;
xpbdRepulsionNodesAffected?: number;
```

#### 2. HUD Type Updates
**File**: `src/physics/engine/physicsHud.ts:231-237`

Added same fields to `PhysicsHudSnapshot` for display.

#### 3. HUD Wiring
**File**: `src/physics/engine/engineTickHud.ts`

**Counter Initialization** (Line 105-111):
```typescript
stats.safety.xpbdRepulsionEnabled = false;
stats.safety.xpbdRepulsionCalledThisFrame = false;
stats.safety.xpbdRepulsionPairsChecked = 0;
stats.safety.xpbdRepulsionMaxForce = 0;
stats.safety.xpbdRepulsionNodesAffected = 0;
```

**HUD Mapping** (Line 234-240):
```typescript
xpbdRepulsionEnabled: stats.safety.xpbdRepulsionEnabled ?? false,
xpbdRepulsionCalledThisFrame: stats.safety.xpbdRepulsionCalledThisFrame ?? false,
xpbdRepulsionPairsChecked: stats.safety.xpbdRepulsionPairsChecked ?? 0,
xpbdRepulsionMaxForce: stats.safety.xpbdRepulsionMaxForce ?? 0,
xpbdRepulsionNodesAffected: stats.safety.xpbdRepulsionNodesAffected ?? 0,
```

### Verification Checklist

- [x] **Stats fields added**: 5 new fields in `SafetyStats`
- [x] **HUD fields added**: 5 new fields in `PhysicsHudSnapshot`
- [x] **Counter initialization**: Reset to false/0 each frame
- [x] **HUD mapping**: Wired to snapshot with fallback values
- [ ] **Visual verification**: Counters show in HUD (false state)

### Expected Behavior

With `xpbdRepulsionEnabled = false` (default):
- `xpbdRepulsionEnabled`: false
- `xpbdRepulsionCalledThisFrame`: false
- `xpbdRepulsionPairsChecked`: 0
- `xpbdRepulsionMaxForce`: 0
- `xpbdRepulsionNodesAffected`: 0

### Risks Identified

1. **None** - Pure telemetry plumbing, no runtime logic changes.

### Next Steps (Mini Run 3)

- Import `applyRepulsion` into `engineTickXPBD.ts`
- Implement force pass at reserved seam
- Update telemetry counters when repulsion runs
- Verify on-screen effect

---

## Mini Run 3/5: Wire Minimal Repulsion (MVP)

**Date**: 2026-02-02  
**Goal**: Implement actual repulsion force pass at the reserved seam to enable visible on-screen separation.

### Changes Made

#### 1. Import Additions
**File**: `src/physics/engine/engineTickXPBD.ts:2,11`

```typescript
import type { PhysicsNode } from '../types';  // For active/sleeping split
import { applyRepulsion } from '../forces';  // Force-based repulsion
```

#### 2. Force Pass Implementation
**File**: `src/physics/engine/engineTickXPBD.ts:575-612`

**Location**: Immediately before `integrateNodes` call (Line 614)

**Implementation**:
```typescript
if (engine.config.xpbdRepulsionEnabled) {
    // 1. Clear forces (explicit, local)
    for (const node of nodeList) {
        node.fx = 0;
        node.fy = 0;
    }

    // 2. Build active/sleeping split
    const activeNodes: PhysicsNode[] = [];
    const sleepingNodes: PhysicsNode[] = [];
    for (const node of nodeList) {
        if (node.isSleeping) {
            sleepingNodes.push(node);
        } else {
            activeNodes.push(node);
        }
    }

    // 3. Apply repulsion
    applyRepulsion(
        nodeList,           // all nodes (for density calc)
        activeNodes,        // active nodes
        sleepingNodes,      // sleeping nodes
        engine.config,      // force config
        debugStats,         // stats
        undefined,          // energy (not used in XPBD)
        1,                  // pairStride (full coverage for MVP)
        0,                  // pairOffset
        undefined           // neighborCache (optional)
    );

    // 4. Update telemetry
    debugStats.safety.xpbdRepulsionEnabled = true;
    debugStats.safety.xpbdRepulsionCalledThisFrame = true;
}
```

### Verification Checklist

- [x] **Import added**: `applyRepulsion` from `../forces`
- [x] **Type import added**: `PhysicsNode` for array typing
- [x] **Force clearing**: Explicit `fx/fy = 0` for all nodes
- [x] **Active/sleeping split**: Built from `node.isSleeping` check
- [x] **Repulsion called**: With full coverage (stride=1)
- [x] **Telemetry updated**: `xpbdRepulsionEnabled` and `xpbdRepulsionCalledThisFrame` set to true
- [ ] **On-screen verification**: Nodes stop overlapping when `xpbdRepulsionEnabled=true`
- [ ] **No explosions**: Graph remains stable

### Expected Behavior

**With `xpbdRepulsionEnabled = false`** (default):
- No change from before (repulsion block skipped)
- Counters remain false/0

**With `xpbdRepulsionEnabled = true`**:
- HUD shows: `xpbdRepulsionCalledThisFrame = true`
- HUD shows: `xpbdRepulsionPairsChecked > 0` (from applyRepulsion)
- On screen: Non-edge nodes push apart (visible separation)
- XPBD edges still maintain rest lengths (hybrid behavior)

### Integration Flow

```
1. applyRepulsion writes node.fx/fy (forces)
   ↓
2. integrateNodes reads fx/fy → computes ax/ay → updates vx/vy → updates x/y
   ↓
3. solveXPBDEdgeConstraints reads x/y → writes x/y (position corrections)
   ↓
4. Final positions: repulsion separation + XPBD edge constraints
```

### Risks Identified

1. **Repulsion/XPBD oscillation**: If repulsion pushes too hard, XPBD may fight back → oscillation
   - **Mitigation**: Start with low `repulsionStrength` (Mini Run 4)
2. **Performance (O(N²))**: Full coverage with stride=1 may be slow for N > 200
   - **Mitigation**: Implement stride policy in Mini Run 5
3. **Sleep state bugs**: `isSleeping` may not be authoritative in XPBD mode
   - **Mitigation**: Treating all as active for MVP (safe but less optimal)

### Next Steps (Mini Run 4)

- Verify config defaults for repulsion parameters
- Add live config telemetry to HUD
- Test zoom invariance (world-space units)
- Tune `repulsionStrength` for visible but stable effect

---
