# Fix: Scale Hardening & Overdraw Prevention

## Problem Dissected
1.  **O(N) Assumptions (`51`)**: The rendering loop was iterating all nodes and links, projecting them to screen space (`O(N)` matrix ops), and then letting the Canvas API or simple bounds checks cull them. At 10k nodes, 10k projections + 20k link projections per frame (60fps) is heavy.
2.  **Overdraw Storms (`52`)**: Even if offscreen nodes are culled, zoomed-out views (Civilization Scale) render thousands of tiny dots. Drawing thousands of text labels (which require texture atlas lookups or font rasterization) and gaussian glows creates massive fill-rate pressure.

## Solution Strategy

### 1. World Space Culling
We added `getVisibleBounds()` to `CameraTransform`. This maps the screen corners to World Space AABB.
- **Old Way**: `foreach node: project(node) -> check if on screen`.
- **New Way**: `foreach node: check if node.x/y in worldAABB`.
- **Benefit**: Avoids matrix math for offscreen objects. Direct coordinate comparison is extremely fast.

### 2. Level of Detail (LOD) Rules
We implemented View-Dependent rendering rules:
- **Labels**:
    - **Zoom < 0.4**: Labels are **HIDDEN** globally.
    - **Exception**: Hovered or Selected nodes *always* show labels (Contextual Detail).
- **Glows**:
    - **Screen Radius < 2px**: Glows are disabled. The node is too small for a glow to be visible/meaningful.
- **Tiny Nodes**:
    - If a node is < 3px on screen and not interesting (low energy), we skip labels and complex shading.

### 3. Pipeline Integration
In `graphRenderingLoop.ts`, we compute `visibleBounds` **once per frame** and pass it down. This ensures all draw layers share the exact same culling logic.

## Verification Steps & Observations

### 1. Scale Simulation
- **Test**: Simulated 5000 nodes.
- **Observation (Pre-Fix)**: Zooming out caused FPS drop due to drawing 5000 labels and glows.
- **Observation (Post-Fix)**: Zooming out -> Labels vanish, Glows vanish. FPS actually *improves* at low zoom because we draw simple circles.

### 2. Zoom-In / Zoom-Out Transition
- **Test**: Rapidly zoomed in and out.
- **Observation**: Labels fade in/out at 0.4x zoom. No popping of offscreen elements (padding handles this).

### 3. Culling Accuracy
- **Test**: Panned the camera.
- **Observation**: Nodes entering the viewport appear smoothly. No artifacts at the edges.

## Conclusion
The renderer now respects the "Civilization" scale constraint. It draws what matters (Visible + Significant) and discards the rest (Offscreen + Microscopic).
