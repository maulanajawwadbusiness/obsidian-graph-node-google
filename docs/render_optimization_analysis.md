# Forensic Analysis: Render Optimization & FPS

**Date**: 2026-01-30
**Scope**: Rendering Pipeline Performance Check (FPS Focus)
**Status**: Analysis Complete (No immediate code changes required)

## Executive Summary
The rendering pipeline (`graphRenderingLoop.ts`, `graphDraw.ts`) is highly optimized and adheres strictly to the "Sacred 60" / "Visual Dignity" doctrine.  Major performance cliffs (filters, shadow blur, unnecessary state changes) have been successfully mitigated in Phases 1-6.

The system is currently in a **"Hardened"** state.

## Key Strengths (Verified)

### 1. Link Rendering (Best in Class)
*   **Batching**: `drawLinks` achieves O(1) draw call overhead for the entire edge set by accumulating all paths into a single `firstName/stroke` operation.
*   **Culling**: Viewport AABB culling is applied effectively.

### 2. Guarded Expensive Operations
*   **Gradients**: `gradientCache` prevents expensive `createRadialGradient` calls per frame.
*   **Glows**: `drawTwoLayerGlow` is optimized to use cached gradients and avoids `ctx.filter`, which is a known performance killer.
*   **Text**: `drawLabels` sets font/fillStyle ONCE per frame (outside the loop), minimizing state thrashing.

### 3. Stability & Precision
*   **Unified Transform**: `CameraTransform` combined with `snapToGrid` ensures crisp rendering at rest and smooth motion during interaction.
*   **Scheduler**: The "Holy Grail" scheduler correctly detects overload and drops debt to prevent "death spirals".

## Potential Bottlenecks (For Future Optimization)

While the current system is robust, the following areas represent the next logical vectors for optimization if FPS drops under extreme load (>5,000 nodes):

### 1. `drawNodes` State Overhead
*   **Issue**: Unlike links, nodes are drawn one-by-one (`O(N)` draw calls).
*   **Reason**: Each node has a unique calculated color (`lerpColor` based on energy) and potentially unique radius.
*   **Impact**: High CPU overhead for iterating and issuing canvas commands for thousands of nodes.
*   **Mitigation (Future)**:
    *   **Bucketing**: Group nodes by "energy quantization" (e.g., 5 levels of energy) and batch draw them.
    *   **Instanced Rendering**: (If moving to WebGL/Regl).

### 2. `ctx.save() / ctx.restore()` Thrash
*   **Location**: `drawGradientRing` in `canvasUtils.ts`.
*   **Issue**: It calls `ctx.save()` and `ctx.restore()` for **every single node** that uses a ring style.
*   **Impact**: `save/restore` are relatively expensive operations in the canvas state machine.
*   **Recommendation**: Refactor `drawGradientRing` to manager state manually (like `drawTwoLayerGlow` does) if profiling shows it as a hot path.

### 3. Linear Culling (O(N))
*   **Issue**: `drawNodes` and `drawLinks` iterate the entire dataset to check bounds (`forEach`).
*   **Impact**: As N grows > 10,000, simply *looping* to check `if (visible)` becomes a bottleneck, even if we don't draw.
*   **Mitigation (Future)**: Spatial Partitioning (Quadtree) to query only visible nodes.

### 4. Legacy Code Paths
*   **Observation**: `drawNodes` contains a legacy fallback for `theme.glowEnabled` which uses `ctx.filter` (Line 306).
*   **Risk**: If configuration accidentally enables this legacy path, performance will tank immediately.
*   **Recommendation**: Ensure `theme.glowEnabled` is false or deprecated in favor of `theme.useTwoLayerGlow`.

## Conclusion
The renderer is in excellent shape. No critical "perf leaks" were found in the active path. The "Holy Grail" loop is working as designed.
