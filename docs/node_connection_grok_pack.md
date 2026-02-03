# Forensic Scan: Manual Dot-to-Dot Connection

**Date**: 2026-02-03
**Subject**: Topology Mutation & Manual Link Analysis
**Grok Pack ID**: LINK-MANUAL-001

---

## 1. Truth Map (Call Chain & Ownership)

*   **Creation (The Origin)**
    *   **File**: `src/playground/graphRandom.ts`
    *   **Function**: `generateRandomGraph` (Lines 11-316).
    *   **Logic**: Procedurally generates `links: PhysicsLink[]` based on Spine/Rib/Fiber logic. Returns object `{ nodes, links }`.
    *   **Handover**: `GraphPhysicsPlayground.tsx` calls this, then iterates results: implies `engine.addLink(l)`.

*   **Storage (The Ledger)**
    *   **File**: `src/physics/engine/engine.ts` (Class `PhysicsEngine`)
    *   **Structure**: `public links: PhysicsLink[] = [];` (Line 15).
    *   **Index**: `public adjacencyMap = new Map<string, string[]>();` (Line 168). Cache for O(1) neighbor lookups.

*   **Rendering (The View)**
    *   **File**: `src/playground/rendering/graphDraw.ts`
    *   **Function**: `drawLinks` (Line 18).
    *   **Read**: Iterates `engine.links.forEach(...)` (Line 56).
    *   **Dedupe**: Uses `source < target` canonical key to prevent double-draw.

*   **Physics (The Solver)**
    *   **File**: `src/physics/engine/engineTickXPBD.ts`
    *   **Function**: `rebuildXPBDConstraints` (Line 110).
    *   **Read**: Iterates `engine.links` to generate `XPBDConstraint` objects.
    *   **Trigger**: Controlled by `engine.xpbdConstraintsDirty`.

---

## 2. Inventory of Topology Mutation APIs
**Location**: `src/physics/engine/engineTopology.ts`

*   [x] **addLinkToEngine** (Line 70)
    *   **Logic**: Pushes to `engine.links`. Updates `adjacencyMap` (both directions). Updates `nodeLinkCounts`. Sets `xpbdConstraintsDirty = true`.
    *   **Checks**: `engine.topologyLinkKeys.has(key)` preventing duplicates. Max link caps.
*   [ ] **removeLink**
    *   **Status**: **MISSING**.
    *   **Requirement**: Needs to find link index, splice from array, remove from `adjacencyMap` (both sides), remove from `topologyLinkKeys`, decrement `nodeLinkCounts`, set dirty flags.
*   [x] **clearEngineState** (Line 132)
    *   **Logic**: Wipes all arrays/maps for full reset.

---

## 3. Minimum-Diff Patch Seam
**Canonical Location**: `src/physics/engine/engineTopology.ts`

**Proposed Changes**:
1.  **Add `removeLinkFromEngine` export**:
    *   Input: `source: string, target: string`.
    *   Action: Filter `engine.links`. Update `adjacencyMap`. Clear `topologyLinkKeys` entry. Set `xpbdConstraintsDirty = true`.
2.  **Add `setLinksInEngine` export**:
    *   Input: `links: PhysicsLink[]`.
    *   Action: `engine.links = links`. Rebuild `adjacencyMap` and `topologyLinkKeys` from scratch. Set dirty flags.

**Source of Truth**:
*   `engine.links` (Array) remains the **Primary Truth**.
*   `adjacencyMap` and `topologyLinkKeys` must be kept in sync as **Derived Truths**.

---

## 4. Directed vs Undirected Strategy
**No PBD Rewrite Required.**

**Schema Extension (`src/physics/types.ts`)**:
```typescript
export interface PhysicsLink {
    source: string;
    target: string;
    // ... existing props
    
    // NEW Fields
    directed?: boolean;    // If true, render arrow A->B. Physics is still A-B.
    kind?: 'manual' | 'ai' | 'structural'; // Metadata for styling/filtering
    id?: string;           // Optional UUID for specific link addressing
}
```

**Philosophy**:
*   **Physics**: Treat all links as **Undirected Springs**. A spring pulling A to B is the same as B to A. XPBD constraints do not care about direction.
*   **Rendering**: `drawLinks` reads `link.directed`. If true, draws arrowhead at `target`.
*   **Adjacency**: `adjacencyMap` remains bidirectional (A has B, B has A) to ensure wake-up propagation works correctly (pulling B wakes A).

---

## 5. Risks & Invariants

*   **ID Collision**:
    *   Graph generation uses `n0`, `n1`, `n2`. Manual additions should use UUIDs or check `engine.nodes.has(id)` before creating.
    *   **Invariant**: `addLinkToEngine` already handles duplicate keys (`source:target`).
*   **Topology Rebuild**:
    *   **Critical**: Any mutation MUST set `engine.xpbdConstraintsDirty = true` and `engine.triangleCache = null`.
    *   **Verify**: `engineTickXPBD.ts` checks `if (engine.xpbdConstraintsDirty)` at start of tick. This path is solid.
*   **Pointer Capture**:
    *   Do NOT mutate topology while `engine.draggedNodeId` is active if possible (or handle `dragConstraint` rebuild gracefully). It likely handles it, but safest to block mutation during drag.
*   **Performance**:
    *   `removeLink` via `splice` is O(N) on the links array. For <1000 links, this is fine. For 10k+, might need a `Map<key, index>` or lazy removal. Recommended start: `splice` (simple).
