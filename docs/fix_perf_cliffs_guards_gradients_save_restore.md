# Rendering Hardening Report: Performance Cliffs
**Date**: 2026-01-30
**Task**: Harden Render Loop against Perf Cliffs (Gradients, Save/Restore, Expensive Effects)

## 1. Summary of Changes
We successfully hardened the render loop to prevent "one innocent line nukes fps" regressions. The focus was on three pillars: **Gradient Caching**, **Render Guards**, and **State Management Optimization**.

### A. Gradient Caching (`GradientCache`)
*   **Problem**: `createRadialGradient` is expensive. Previously it was called 2x per node per frame (for glow), causing massive GC churn and CPU overhead.
*   **Solution**: Implemented `GradientCache` (singleton).
    *   **Quantization**: Inner/Outer radii are rounded to nearest 0.5px to maximize cache hits.
    *   **Keys**: Composite key of radii + color stops.
    *   **Optimization**: Reworked `drawTwoLayerGlow` to draw at `(0,0)` with `ctx.translate(x,y)`, enabling reuse of a single cached gradient object across all nodes of similar size/energy.
    *   **Metrics**: Logs Hit Rate per second (expected >99% in stable state).

### B. Render Guards (`RenderGuard`)
*   **Problem**: High-cost effects like `ctx.filter` (blur) or `ctx.shadowBlur` can silently creep into hot loops, causing 10x perf drops.
*   **Solution**:
    *   **`guardStrictRenderSettings(ctx)`**: Checks `filter` and `shadowBlur` at the start of hot loops (`drawNodes`, `drawLinks`).
    *   **Violations**: Logs a warning (once per session) if a violation is detected in Dev, and strictly resets it to safe values (`none`, `0`) in Production to prevent catastrophic lag.

### C. Eliminate Save/Restore Storm
*   **Problem**: `ctx.save()` and `ctx.restore()` are relatively expensive operations. `drawNodes` previously used `withCtx` (save/restore) **per node**. For 500 nodes, that's 1000 ops per frame.
*   **Solution**:
    *   **Batching**: Refactored `drawNodes` and `drawLabels` to use a **single** `save/restore` block for the entire loop.
    *   **Manual State**: Inside the loop, we manually verify/reset critical state (`globalAlpha`, `composite`) instead of relying on the heavy `restore()` mechanism.
    *   **Reduction**: Reduced save/restore calls from `O(N)` to `O(1)` for the main node/label/link passes.

## 2. Verification
*   **Visuals**: No regression in visual quality. Gradient quantization (0.5px) is sub-pixel and invisible to the eye compared to the glow fluffiness.
*   **Performance**:
    *   **Gradients**: `GradientCache` hit rate should settle to 100% after the first few frames (once all energy levels/sizes are seen).
    *   **Overhead**: Javascript overhead for the render loop is significantly reduced by removing the per-node closure allocation (`withCtx`) and state stack manipulation.

## 3. Files Modified
*   `src/playground/rendering/gradientCache.ts`: [NEW] Cache implementation.
*   `src/playground/rendering/renderGuard.ts`: [NEW] Safety guards.
*   `src/playground/rendering/canvasUtils.ts`: Updated to use cache, removed `withCtx` from glow.
*   `src/playground/rendering/graphDraw.ts`: Major refactor of draw loops to batch state.
*   `src/playground/rendering/graphRenderingLoop.ts`: Added gradient stats logging.

## 4. Next Steps
*   Monitor `[GradientCache]` logs in console.
*   Watch for `[RenderGuard]` warnings during development of new features.
