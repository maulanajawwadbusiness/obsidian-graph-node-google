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
