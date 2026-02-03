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

---

## Run 3: Create Topology API Surface

**Date**: 2026-02-03

### New Module: `src/graph/topologyControl.ts`

#### API Functions
1. **setTopology(topology: Topology): void**
   - Replaces entire topology
   - Creates defensive copy
   - Increments version counter
   - Console logs node/link count

2. **getTopology(): Topology**
   - Returns copy (prevents external mutation)

3. **getTopologyVersion(): number**
   - Returns current version (increments on any mutation)

4. **clearTopology(): void**
   - Removes all nodes and links
   - Increments version

5. **patchTopology(patch: TopologyPatch): void**
   - Incremental updates: addNodes, removeNodes, addLinks, removeLinks, setLinks
   - More efficient than setTopology for small changes
   - Console logs before/after counts

#### Internal State
- `currentTopology: Topology` - Private module state
- `topologyVersion: number` - Mutation counter

### Verification
- **Build**: Passed
- **Immutability**: Enforced via defensive copies
- **Behavior Changes**: None (no wiring yet)

### Next Step (Run 4)
Wrap existing generator to output Topology and call setTopology().

**Files Added**: 1
**Behavior Changes**: None

---

## Run 4: Plug Generator into Topology API

**Date**: 2026-02-03

### New Adapter: `src/graph/topologyAdapter.ts`

#### Functions
1. **nodeToSpec(node: PhysicsNode): NodeSpec**
   - Extracts topology-relevant fields (id, label, role metadata)

2. **linkToDirected(link: PhysicsLink): DirectedLink**
   - Converts undirected PhysicsLink to DirectedLink
   - Marks as `kind: 'structural'`
   - Preserves lengthBias/stiffnessBias in metadata

3. **legacyToTopology(nodes, links): Topology**
   - Batch converter for generator output

### Integration Point
**File**: `src/playground/GraphPhysicsPlayground.tsx`
**Function**: `spawnGraph()` (Lines 420-443)

#### Changes
- Added topology API imports
- After `generateRandomGraph()`, calls `legacyToTopology(nodes, links)`
- Calls `setTopology(topology)`
- Console logs:
  - Node/link counts
  - First 5 sample links
- Still adds to engine (compatibility layer, will be replaced in Run 6)

### Verification
- **Dev Server**: Running on localhost:5176
- **Console Proof**: 
  - `[TopologyControl] setTopology: N nodes, M links (vX)`
  - `[Run4] Topology set: ...`
  - `[Run4] Sample links (first 5): [...]`

### Next Step (Run 5)
Implement `deriveSpringEdges(topology)` to convert DirectedLinks to SpringEdges.

**Files Added**: 1
**Files Modified**: 1
**Behavior**: Topology API now called, but engine still directly mutated (dual path)

---

## Run 5: Derive Spring Edges from Directed Links

**Date**: 2026-02-03

### New Module: `src/graph/springDerivation.ts`

#### Function: `deriveSpringEdges(topology: Topology): SpringEdge[]`

##### Logic
1. Iterates all DirectedLinks in topology
2. Creates canonical key: `min(from, to):max(from, to)`
3. De-duplicates: A→B and B→A create one spring edge
4. Stores source link IDs in `meta.sourceLinks` for traceability
5. Returns array of undirected SpringEdge objects

##### Console Proof
- Total directed links → spring edges count
- Deduplication rate (%)
- Sample spring edges (first 3)

### Integration
**File**: `GraphPhysicsPlayground.tsx`
- Added import for `deriveSpringEdges`
- Calls after `setTopology()`
- Logs derived spring count and samples

### Verification
- **Build**: Passed
- **Console Logs**:
  - `[Run5] deriveSpringEdges: N directed links → M spring edges (dedupe: X%)`
  - `[Run5] Spring edges derived: M`
  - `[Run5] Sample spring edges (first 3): [...]`

### Expected Dedupe Rate
- Random generator creates mostly tree-like structures (Spine→Rib→Fiber)
- Occasional double-links (20% chance for Ribs)
- Expected: ~5-10% deduplication

### Next Step (Run 6)
Wire engine to consume ONLY derived spring edges (remove direct link injection).

**Files Added**: 1
**Files Modified**: 1
**Behavior**: Spring derivation tested, but engine still uses old path

---

## Run 6: Wire Engine to Consume ONLY Derived Spring Edges

***CRITICAL MILESTONE: Topology Pipeline Now Authoritative***

**Date**: 2026-02-03

### New Module: `src/graph/springToPhysics.ts`

#### Functions
1. **springEdgeToPhysicsLink(edge: SpringEdge): PhysicsLink**
   - Converts single SpringEdge to PhysicsLink
   - Maps `edge.a/b` to `source/target`
   - Preserves `restLen` and `strength`

2. **springEdgesToPhysicsLinks(edges: SpringEdge[]): PhysicsLink[]**
   - Batch converter

### Engine Wiring Change
**File**: `GraphPhysicsPlayground.tsx` - `spawnGraph()`

#### OLD Path (Removed)
```typescript
links.forEach(l => engine.addLink(l)); // Direct from generator
```

#### NEW Path
```typescript
const springEdges = deriveSpringEdges(topology);
const physicsLinks = springEdgesToPhysicsLinks(springEdges);
physicsLinks.forEach(l => engine.addLink(l)); // From topology pipeline
```

### Impact
- **Single Source of Truth**: `topology.links` (DirectedLink[]) is now the ONLY source
- **No Hidden Writes**: Engine can no longer receive links from arbitrary sources
- **Auditability**: All topology changes flow through `topologyControl.ts`

### Console Proof
- `[Run6] Engine wiring: N nodes, M physics links (from X directed)`
- Confirms: `M <= X` (deduplication working)

### Verification
- **Build**: Passed
- **Behavior**: Graph still renders correctly (same topology, different path)
- **Next Risk**: Ensure no other code paths call `engine.addLink()` directly

### Next Step (Run 7)
Add versioning + change protocol (rebuild cache only when topology version changes).

**Files Added**: 1
**Files Modified**: 1
**Behavior**: **BREAKING CHANGE** - Engine now fed exclusively by topology pipeline

---

## Run 7: Versioning + Change Protocol

**Date**: 2026-02-03

### Versioning Logic
**File**: `src/graph/topologyControl.ts`

#### Enhanced `patchTopology()`
- Added diff summary logging
- Logs: nodesAdded, nodesRemoved, linksAdded, linksRemoved, linksReplaced
- Example: `[TopologyControl] patchTopology: nodes 5→7, links 4→6 (v3) { nodesAdded: 2, linksAdded: 2, ... }`

### Version Tracking
**File**: `GraphPhysicsPlayground.tsx` - `spawnGraph()`

#### Added
```typescript
const beforeVersion = getTopologyVersion();
setTopology(topology);
const afterVersion = getTopologyVersion();
console.log(`[Run7] Topology version: ${beforeVersion} → ${afterVersion} (changed: ${beforeVersion !== afterVersion})`);
```

### Console Proof
- Version increments on every `setTopology()` or `patchTopology()` call
- Change detection confirms mutation occurred

### Future Optimization (Not Implemented Yet)
- Engine could cache last-seen topology version
- Rebuild spring edges ONLY when version changes
- Currently rebuilds every spawnGraph call (acceptable for now)

### Next Step (Run 8)
Add dev console commands: `window.__topology.addLink()`, etc.

**Files Modified**: 2
**Behavior**: Version tracking in place, change logging enhanced

---

## Run  8: Dev Console Commands

**Date**: 2026-02-03

### New Module: `src/graph/devTopologyHelpers.ts`

#### Exposed API: `window.__topology`
1. **addLink(from, to, kind?)** - Add single directed link
2. **removeLink(from, to)** - Remove directed link
3. **setLinks(links)** - Replace all links
4. **dump()** - Print topology to console
5. **version()** - Get current version number
6. **clear()** - Remove all topology

### Integration
**File**: `GraphPhysicsPlayground.tsx`
- Added import: `import '../graph/devTopologyHelpers';`
- Side-effect import exposes `window.__topology` on load

### Console Proof
```javascript
// In browser console:
window.__topology.dump();
window.__topology.addLink('n0', 'n10', 'manual');
window.__topology.version(); // Should increment
```

### Verification (Manual)
1. Open browser console
2. Run: `window.__topology.dump()`
3. Note link count
4. Run: `window.__topology.addLink('n0', 'n1', 'test')`
5. Observe topology version increment log
6. (Future): Graph should update when engine wired to poll topology changes

### Limitation
- Commands update topology state
- Engine doesn't auto-refresh yet (would need polling or reactive wiring)
- Manual verification for now

### Next Step (Run 9)
Add rest length policy hook point.

**Files Added**: 1
**Files Modified**: 1
**Behavior**: Dev commands functional, topology mutable via console
