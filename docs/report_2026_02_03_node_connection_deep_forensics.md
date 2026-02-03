# Deep Forensic Report: The "Upload-to-Map" Pipeline

**Date**: 2026-02-03
**Subject**: Exhaustive Analysis of Node Logic, System Connections, and Topological Origins
**Doc ID**: FORENSIC-V3-EXHAUSTIVE

---

## 1. Executive Summary: The Structural Illusion
The user's core query is "Why does Node 1 connect to Node 2?".
The forensic answer is: **Random Chance.**
There is **no semantic logic** connecting the document content to the graph structure. The system superimposes document text onto a pre-existing, randomly generated skeleton. The connections are physical (springs), not logical (relationships).

---

## 2. Evidence Trace ("The Chain of Custody")

### Phase 1: The Input (Document Parser)
**What**: converting raw file data into a text string.
**Code Location**: `src/document/documentWorker.ts`
*   **System Connection**: Runs in a separate Web Worker thread to prevent UI freezing.
*   **Mechanism**:
    1.  Receives `File` object from Main Thread.
    2.  Selects parser based on MIME type (`TextParser`, `DocxParser`, `PdfParser`).
    3.  Extracts raw text content.
*   **Output**: `ParsedDocument` object (`{ text: "...", meta: { wordCount: ... } }`).
*   **Forensic Note**: At this stage, the data is a linear stream of text. **No nodes or links exist yet.**

### Phase 2: The Binding (The "Sticker" Logic)
**What**: Pasting text labels onto existing physics objects.
**Code Location**: `src/document/nodeBinding.ts`
*   **Function**: `applyFirstWordsToNodes` (Fast) & `applyAnalysisToNodes` (Smart).
*   **Logic (How)**:
    1.  Get the list of *existing* nodes from the Physics Engine: `Array.from(engine.nodes.values())`.
    2.  Slice the first 5 nodes (`nodes.slice(0, 5)`).
    3.  Take the first 5 words (or AI points) from the document.
    4.  Assign `node[i].label = word[i]`.
*   **Why**: The system assumes a graph *already exists*. It does not build one.
*   **Critical Gap**: The code explicitly ignores Node 6 through Node N. It serves purely as a visual preview, not a data visualization.

### Phase 3: The AI Analyzer (The Missing Link)
**What**: Extracting meaning from text.
**Code Location**: `src/ai/paperAnalyzer.ts`
*   **Prompt**: "Analyze... and extract exactly 5 distinct main_points."
*   **Schema**:
    ```typescript
    {
      points: [
        { title: "Point A", summary: "..." },
        { title: "Point B", summary: "..." }
      ] // Tuple of 5 isolated objects
    }
    ```
*   **Issue**: The AI is **never asked** to identify relationships. It produces a "Bag of Points", not a "Network of Ideas". This confirms why the graph cannot possibly reflect semantic connections—the data simply isn't there.

---

## 3. The Topology ("How nodes connect")

### "What set line between node?"
**Code Location**: `src/playground/graphRandom.ts` -> `generateRandomGraph`
**Mechanism**: Deterministic Procedural Generation ("Spine-Rib-Fiber").
1.  **The Spine**: The RNG creates a chain (Node 0 → Node 1 → Node 2).
2.  **The Ribs**: The RNG picks a random Spine node and attaches a Rib node.
3.  **The Fibers**: The RNG picks a random Rib node and attaches a Fiber node.

### "What decide 2 node connect?"
**The Seed**.
*   Every spawn is driven by `process.env.SEED` (or `Date.now()`).
*   If `seed = 100`, Node 1 *always* connects to Node 2.
*   The **Document Content** is irrelevant. You could upload "Hamlet" or a "Shopping List"—the connections will be identical for the same seed.

### "How 1 node can have multi-connection node?"
**Code Location**: `src/physics/engine/engineTopology.ts`
*   **Data Structure**: `adjacencyMap: Map<string, string[]>`
*   **Logic**:
    *   Link A-B is stored as `A -> [B]` and `B -> [A]`.
    *   When forces are calculated (`engineTickXPBD.ts`), the solver iterates through all constraints.
    *   Node A acts as a "hub" simply by having multiple constraints pulling on it simultaneously. The physics engine sums these vectors: `V_final = V_spring1 + V_spring2 + ...`.

---

## 4. System Reliability & Conflicts

### Conflict Type A: Semantic Hallucination
*   **Problem**: The user sees Node A connected to Node B and assumes "A implies B".
*   **Reality**: Node A is "Introduction" (Spine item 0). Node B is "Conclusion" (Spine item 4). They are connected because they are part of the backbone chain, NOT because the introduction references the conclusion.
*   **Reliability**: **0%**. The graph is topologically valid but semantically void.

### Conflict Type B: The "5-Node" Limit
*   **Problem**: If the AI extracts 6 points, the 6th is discarded.
*   **Mechanism**: `nodes.slice(0, 5)`.
*   **Result**: Information loss. The graph cannot scale to complex documents.

### Conflict Type C: ID Collision
*   **System Connection**: Nodes use IDs `n0`, `n1`, `n2`.
*   **Risk**: If a new module attempts to inject nodes using the same naming convention without checking `engine.nodes.has()`, it will overwrite existing physics state (velocity, position).
*   **Mitigation**: `engineTopology.ts` has `perfCounters.topologyDuplicates` to detect/reject duplicate link keys, but node overwrites might be silent state resets.

---

## 5. Intersystem Communication

### The Glue: `GraphPhysicsPlayground.tsx`
This component acts as the "Controller":
1.  **Receives** Drop Event (React Layer).
2.  **Invokes** Worker (Document Layer).
3.  **Invokes** AI (Cloud Layer).
4.  **Mutates** Engine (Physics Layer) via direct reference `engineRef.current.nodes`.

### The Weakness
The controller is naive. It treats the Physics Engine as a "dumb view" rather than a data visualization tool. It pushes labels *into* the view, but never asks the view to *reconfigure* itself around the data.

---

## 6. Recommendations for "True" Mapping

To fix the "Why" and "How":
1.  **Update Parser**: Change `paperAnalyzer.ts` to return `links: { source: string, target: string, type: string }[]`.
2.  **Update Binding**: Deprecate `applyFirstWordsToNodes`. Create `spawnGraphFromDocument(engine, analysisResult)`.
3.  **Logic Switch**:
    *   Current: "Topology first, Label second".
    *   Required: "Data first, Topology derived".
