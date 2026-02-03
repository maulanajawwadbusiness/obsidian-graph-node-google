# Forensic Report: Document Parsing & Node Connection Architecture

**Date**: 2026-02-03
**Subject**: Thorough Scan of "Upload to Node map" Pipeline
**Severity**: **CRITICAL ARCHITECTURAL DISCONNECT DETECTED**

## 1. Executive Summary: The "Semantic Disconnect"
The system currently performs a **"Projection"** operation, not a **"Generation"** operation.
*   **User Expectation**: "I upload a file, and the system builds a map *based on that file*."
*   **Actual Behavior**: The system generates a **random graph topology** (Spine-Rib-Fiber) *independently* of the file. When a file is uploaded, the first 5 words/points are simply **pasted** onto the first 5 nodes of this pre-existing random structure.
*   **Result**: Node 1 connects to Node 2 because the **Random Number Generator (RNG)** decided so, not because "Paragraph 1 is related to Paragraph 2".

---

## 2. The Pipeline: "What, How, Code Location"

### Step A: Document Ingestion
**Location**: `src/playground/GraphPhysicsPlayground.tsx` -> `handleDrop` (Line 312)
**Code**:
```typescript
const document = await documentContext.parseFile(file);
if (document) {
    applyFirstWordsToNodes(engineRef.current, document);
    // ... triggers AI ...
}
```
**Mechanism**:
1.  User drags file.
2.  `documentContext.parseFile` sends file to `src/document/workerClient.ts`.
3.  Worker selects parser properties (`src/document/parsers/*.ts`) and extracts raw text.
4.  Returns a `ParsedDocument` object.

### Step B: The Binding (The "Planting")
**Location**: `src/document/nodeBinding.ts`
**Code**:
```typescript
export function applyFirstWordsToNodes(engine, document) {
  const words = document.text.split(...).slice(0, 5);
  const nodes = Array.from(engine.nodes.values()).slice(0, 5);
  nodes.forEach((node, i) => {
    node.label = words[i]; // <--- THE PLANTING
  });
}
```
**Forensic Finding**:
*   The system takes the **first 5 nodes** found in the engine's memory.
*   It overwrites their labels.
*   **It does NOT create new nodes.**
*   **It does NOT create new links.**
*   It ignores the remaining 95% of the graph nodes, leaving them as "Node N".

### Step C: The Graph Generator (The "Map Maker")
**Location**: `src/playground/graphRandom.ts` -> `generateRandomGraph`
**Trigger**: App launch or Sidebar "Spawn" button. **NOT triggered by upload.**
**Logic**:
This file defines "How Node 1 connects to Node 2". It uses a **"Spine-Rib-Fiber"** topology model:
1.  **Spine (Nodes 0-4)**: Created first. Placed along a diagonal axis.
    *   *Connection Rule*: Node `i` connects to Node `i-1`.
    *   *Result*: A line or "snake".
2.  **Ribs (Nodes 5-10)**: Created second.
    *   *Connection Rule*: Randomly picks a **Spine** node as "Anchor". Connects to it.
    *   *Result*: Branches growing off the spine.
3.  **Fibers (Nodes 11+)**: Created last.
    *   *Connection Rule*: Randomly picks a **Rib** node as "Anchor". Connects to it.
    *   *Result*: Fine details/leaves growing off ribs.

**Deterministic Seeding**:
The entire structure is governed by `seed: number`. If `seed = 1337`, the connections are identical every time. The document content has **zero influence** on this seed.

---

## 3. Connection Diagnostics

### "How Node 1 connects to Node 2"
*   **Reason**: Purely topological role assignment in `graphRandom.ts`.
*   **Example**: If Node 0 is Spine and Node 5 is Rib, Node 5 *might* connect to Node 0 if the RNG selected Node 0 as Node 5's anchor.
*   **Semantic Reason**: None. "Introduction" (Node 0) connects to "Conclusion" (Node 5) purely by luck.

### "How Multi-Connection Works"
**Location**: `src/physics/engine/engine.ts` -> `adjacencyMap`
**Mechanism**:
*   The `links` array stores pairs: `{ source: "n0", target: "n1" }`.
*   Nodes do not limit connections. "Hubs" (Spine nodes) often have 5-6 connections (1 spine neighbor + 4-5 ribs attached).
*   **Physics**: The engine sums forces from all connected springs.
    *   `F_total = F_spring1 + F_spring2 + ...`
    *   This naturally handles multi-connected meshes without special logic.

---

## 4. Reliability & Issues

### Issue A: The "Semantic Hallucination"
*   **Problem**: The graph topology implies relationships (A is central to B) that do not exist in the document.
*   **Severity**: Critical. The visualization is misleading. It visualizes the *RNG's structure*, not the *Document's structure*.

### Issue B: The "5-Node Cap"
*   **Problem**: `applyFirstWordsToNodes` hardcodes `.slice(0, 5)`.
*   **Impact**: Even if the graph has 50 nodes, only the first 5 get labels from the document. The rest remain generic placeholders.

### Issue C: Static Topology
*   **Problem**: Parsing a new document does not re-spawn the graph.
*   **Impact**: If you swap a complex PDF for a simple text file, the graph shape remains exactly the same chaotic mesh.

---

## 5. Recommendation
To fix the "Why" and make connections meaningful:
1.  **Semantic Parsing**: The parser must return a *list* of concepts and *relationships*, not just raw text.
2.  **Dynamic Spawning**: `handleDrop` must call `spawnGraph` (or a new `spawnSemanticGraph`) instead of just `applyFirstWordsToNodes`.
3.  **Topology Mapping**: `generateRandomGraph` should accept an adjacency matrix derived from the AI analysis, creating links where concepts are actually related.
