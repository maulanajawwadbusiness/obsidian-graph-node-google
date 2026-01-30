# Fix: Text Density, Hit Test Scaling, GC Churn

## Problem Dissected
1.  **Text Fog (53)**: At 5000 nodes, drawing 5000 labels allows no clear reading and kills FPS.
2.  **O(N) Hover (54)**: Every mouse move iterated 5000 nodes. 5000 * 60 = 300,000 checks/sec. 
3.  **GC Churn (55)**: Per-frame arrays from `.filter()`, `.map()`, and object allocations caused sawtooth memory pattern.

## Solution Strategy

### 1. Spatial Grid (O(1) Hit Test)
We implemented `SpatialGrid` (bucket hashing).
- **Build**: Every frame, we only add *visible* nodes to the grid (already iterating for draw).
- **Query**: Mouse hover queries only the bucket under cursor.
- **Result**: ~10 checks per frame instead of 5000.

### 2. RenderScratch (GC Reduction)
We introduced `RenderScratch` class.
- **Reusable Arrays**: `visibleNodeIndices` is a persistent array needed for the frame.
- **Workflow**:
    1.  `renderScratch.prepare()` clears counters (not arrays) and fills them.
    2.  `drawNodes` iterates `renderScratch.visibleNodeIndices` directly.
- **Benefit**: Zero array allocations during render loop.

### 3. Label Budgeting
We added strict limits to `drawLabels`:
- **Hard Cap**: Max 200 labels per frame (non-hovered).
- **LOD**:
    - Zoom < 0.5: Max 50 labels.
    - Zoom < 0.4: Labels hidden (unless hovered).
- **Priority**: Hovered nodes *always* draw labels, bypassing budget.

## Verification Steps & Observations

### 1. Label Density
- **Test**: Zoom out to "Civilization" view.
- **Observation**: Instead of a black cloud of text, we see a clean dot map. Hovering a node instantly reveals its label (Contextual).

### 2. Hit Test Response
- **Test**: Sweeping mouse across dense cluster.
- **Observation**: Hover highlights update instantly 60fps. No CPU spike on profile.

### 3. Memory Stability
- **Test**: Running for 60 seconds.
- **Observation**: Memory usage is flat (no sawtooth).

## Conclusion
The renderer is now hardened for high scale. It respects the limited pixel budget of the screen and the limited cycle budget of the CPU.
