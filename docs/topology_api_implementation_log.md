# Topology API Implementation Log

**Project**: First-Class Topology Control
**Goal**: Separate knowledge graph (directed links) from physics graph (undirected springs)
**Timeline**: 10 runs, commit every 2 runs

---

## Run 1: Scandissect + Map Current Topology Ownership

**Date**: 2026-02-03

### Current Architecture Call Chain

#### 1. Node/Edge Creation (Origin)
- **File**: `src/playground/graphRandom.ts`
- **Function**: `generateRandomGraph(nodeCount, targetSpacing, initScale, seed, ...)` (Lines 11-316)
- **Logic**: 
  - Creates `nodes: PhysicsNode[]` array
  - Creates `links: PhysicsLink[]` array
  - Uses SeededRandom for deterministic topology
  - Returns `{ nodes, links }`

#### 2. Topology Randomization (The RNG Layer)
- **File**: `src/playground/graphRandom.ts`
- **Lines**: 
  - Spine links: 206-219 (chain + occasional grandparent branching)
  - Rib links: 249-268 (anchor to spine + 20% double-link)
  - Fiber links: 296-302 (anchor to ribs)
- **Randomness**: All driven by `SeededRandom(seed)` for determinism

#### 3. Link Storage (The Ledger)
- **File**: `src/physics/engine.ts`
- **Property**: `public links: PhysicsLink[] = []` (Line 15)
- **Derived Cache**: `public adjacencyMap = new Map<string, string[]>()` (Line 168)

#### 4. Link Mutation (The Gate)
- **File**: `src/physics/engine/engineTopology.ts`
- **Function**: `addLinkToEngine(engine, link)` (Lines 70-115)
- **Side Effects**:
  - Pushes to `engine.links`
  - Updates `adjacencyMap` (bidirectional)
  - Updates `nodeLinkCounts`
  - Sets `xpbdConstraintsDirty = true`
  - **Duplicate Prevention**: Uses `topologyLinkKeys: Set<string>` with canonical key `min(a,b):max(a,b)`

#### 5. Spring Constraint Building (The Solver Input)
- **File**: `src/physics/engine/engineTickXPBD.ts`
- **Function**: `rebuildXPBDConstraints(engine)` (Lines 110-201)
- **Trigger**: Checks `if (engine.xpbdConstraintsDirty)` at tick start (Line 501)
- **Logic**:
  - Iterates `engine.links`
  - Creates `XPBDConstraint` objects: `{ nodeA, nodeB, restLen, compliance, lambda }`
  - Computes `restLen = clamp(currentDistance, MIN_REST=10, MAX_REST=1000)`
  - **Key**: Every link becomes one undirected constraint

#### 6. Rendering Consumption
- **File**: `src/playground/rendering/graphDraw.ts`
- **Function**: `drawLinks(...)` (Line 18)
- **Read**: `engine.links.forEach(link => ...)` (Line 56)
- **Dedupe**: Uses `source < target` key to prevent double-draw

### Current Issues (Pre-Refactor)
1. **Multiple Owners**: Links created in `graphRandom.ts`, stored in `engine.ts`, consumed by XPBD and rendering.
2. **No Direction Metadata**: `PhysicsLink` has `source/target` but no semantic direction flag.
3. **Hidden Mutation**: `addLinkToEngine` can be called from anywhere (though currently only from `GraphPhysicsPlayground.tsx`).
4. **No Versioning**: No way to detect if topology changed since last frame.
5. **Missing APIs**: No `removeLink`, no `setLinks`, no `getTopology`.

### Next Step (Run 2)
Introduce first-class types: `DirectedLink`, `Topology`, `SpringEdge`.

**Files Scanned**: 5
**Behavior Changes**: None (pure analysis)

---

## Run 2: Introduce First-Class Topology Types

**Date**: 2026-02-03

### New Types Created
**File**: `src/graph/topologyTypes.ts` (new)

#### Type Definitions
1. **NodeId**: `type NodeId = string` - Unique node identifier
2. **DirectedLink**: Semantic relationship between nodes
   - `from: NodeId` - Source node
   - `to: NodeId` - Target node
   - `kind?: string` - Relationship type (e.g., 'causal', 'reference')
   - `weight?: number` - Semantic strength (0-1)
   - `meta?: Record<string, unknown>` - Extensible metadata
3. **NodeSpec**: Minimal node definition
   - `id: NodeId`
   - `label?: string`
   - `meta?: Record<string, unknown>`
4. **Topology**: The knowledge graph
   - `nodes: NodeSpec[]`
   - `links: DirectedLink[]`
5. **SpringEdge**: Physics-layer undirected edge (derived from DirectedLink)
   - `a: NodeId` - Always min(from, to) for canonical ordering
   - `b: NodeId` - Always max(from, to)
   - `restLen?: number` - Optional rest length override
   - `strength?: number` - Optional spring stiffness override
   - `meta?: { sourceLinks?: string[] }` - Traceability to DirectedLinks

### Verification
- **Build**: Passed (types-only, no runtime code)
- **Behavior Changes**: None

### Next Step (Run 3)
Create `topologyControl.ts` API surface: `setTopology()`, `getTopology()`, etc.

**Files Added**: 1
**Behavior Changes**: None
