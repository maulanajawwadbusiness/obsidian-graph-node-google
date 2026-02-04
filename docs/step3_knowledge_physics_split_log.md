# Step 3: Knowledge/Physics Direction Split - Implementation Log

**Goal**: Separate directed knowledge links from undirected physics springs

---

## Run 1: Scandissect + Ownership Map

**Date**: 2026-02-04

### Topology.links Readers Inventory

#### Category A: Knowledge Semantics (Directed)
1. **`topologyControl.ts`** - State management
   - Line 27, 30, 39: Copy/defensive operations
   - Line 81, 166: Counts for logging
   - Line 89: Filter links referencing removed nodes
   - Line 104: Remove specific directed links
   - Line 111: Replace all links
   - Line 126, 151: Add links with validation
   - **Purpose**: Maintain directed knowledge graph state
   - **Decision**: KEEP directed - this is the source of truth

2. **`kgSpecLoader.ts`** - Export/import
   - Line 61-62: Console logs for loaded topology
   - (Also: exportTopologyAsKGSpec uses topology.links - not in grep)
   - **Purpose**: Preserve directed semantics in KGSpec format
   - **Decision**: KEEP directed - must export knowledge as-is

#### Category B: Physics Springs (Undirected)
3. **`springDerivation.ts`** - Spring edge derivation
   - Line 28: `for (const link of topology.links)`
   - Line 67: Count for deduplication stats
   - **Purpose**: Convert directed → undirected springs
   - **Decision**: ALREADY CORRECT - derives springs, doesn't modify links

4. **`GraphPhysicsPlayground.tsx`** - Integration
   - Line 455-456: Console logs (topology info)
   - Line 466: Log showing "physics links (from X directed)"
   - **Purpose**: Display stats, wire springs to engine
   - **Decision**: Keep logs, already separates concerns

#### Category C: Utility/Comments
5. **`restLengthPolicy.ts`** - Policy (commented)
   - Line 31: Future comment about inspecting links
   - **Purpose**: Not currently used
   - **Decision**: No change needed

### Current State Analysis

**Good news**: The architecture is ALMOST there!
- `springDerivation.ts` already converts directed → undirected
- Springs are derived, not stored
- Knowledge links stay directed in topologyControl

**The problem**: Springs are re-derived every call, not stored
- No explicit separation in data model
- XPBD might be consuming the wrong layer

### Next Steps (Run 2)
- Add `topology.springs` storage
- Make DirectedLink vs SpringEdge explicit in types
- Ensure springs persist between renders

**Files Scanned**: 5
**Readers Found**: 9 locations
**Categories**: A(Knowledge)=2 files, B(Physics)=2 files, C(Util)=1 file

---

## Run 2: Split Types + Data Model

**Date**: 2026-02-04

### Type Changes

#### File: `topologyTypes.ts`
Added `springs?: SpringEdge[]` to Topology interface:
```typescript
export interface Topology {
    nodes: NodeSpec[];
    links: DirectedLink[];     // Directed knowledge  
    springs?: SpringEdge[];    // Undirected physics (derived)
}
```

**Semantics**:
- `links`: Directed knowledge edges (A→B ≠ B→A)
- `springs`: Undirected physics springs (one per {A,B} pair)

#### File: `topologyControl.ts`
Updated state management:
1. Initialize `springs: []` in currentTopology
2. Copy spring in `setTopology()`
3. Copy springs in `getTopology()`
4. Reset springs in `clearTopology()`
5. Updated console logs to show springs count

**Console proof**: `setTopology: X nodes, Y links, Z springs (vN)`

### Design Decision
- **Optional springs**: `springs?` allows gradual migration
- **Defensive copying**: Prevents external mutation
- **No breaking changes**: Existing code still works (springs default to [])

### Verification
- **Build**: Passed ✓
- **Backward compat**: topology.links still works

**Files Modified**: 2
**Behavior**: Springs storage added (but not yet populated)

---

## Run 3: Derive Springs from Knowledge

**Date**: 2026-02-04

### New File: `topologySpringRecompute.ts`
Helper function to recompute springs from knowledge links:
```typescript
recomputeSprings(topology, config): Topology
```

**Integration**: `GraphPhysicsPlayground.tsx`
- After `setTopology(topology)`, calls `recomputeSprings()`
- Stores result in `topology.springs`
- Console: `[STEP3-RUN3] Springs recomputed: Z undirected springs from Y directed links`

### Key Points
- **Deduplication**: Uses existing `deriveSpringEdges()` logic
- **One-way**: Springs derived FROM links, never reverse
- **Safe**: Existing deduplication prevents self-loops, missing endpoints

**Files Added**: 1
**Files Modified**: 1
**Behavior**: Springs now populated after topology mutations

---

## Run 4: Rewire XPBD to Springs

**Date**: 2026-02-04

### Engine Consumption Change
**Before**: `springEdgesToPhysicsLinks(springEdges)` (ephemeral)  
**After**: `springEdgesToPhysicsLinks(topology.springs || [])` (stored)

**File**: `GraphPhysicsPlayground.tsx`
- Changed `springEdges` source to `topology.springs`
- Console: `[STEP3-RUN4] XPBD consuming X springs (not Y directed links)`

###Success Criteria Check
✅ **Knowledge layer directed**: topology.links preserves A→B and B→A  
✅ **Physics layer undirected**: topology.springs dedups to {A,B}  
✅ **XPBD consumes springs only**: engine.addLink() uses topology.springs

**Files Modified**: 1
**Behavior**: XPBD now consumes undirected springs (no double-force risk)
