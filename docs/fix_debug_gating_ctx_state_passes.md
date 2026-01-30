# Rendering Hardening Report: State & Debug
**Date**: 2026-01-30
**Task**: Harden Render Loop against State Thrash and Accidental Debug Draws

## 1. Hot Spots Identified
1.  **Debug Draw Leaks**: `drawHoverDebugOverlay` and `perfSample` logs were relying on runtime flags (`theme.hoverDebugEnabled`) that could be accidentally enabled in prod.
2.  **Layer Ordering**: The render loop had implicit ordering.
3.  **State Thrash**: `globalAlpha` setting was loose in `drawNodes`.

## 2. Fixes Implemented

### A. Debug Gating
*   **Change**: Implemented `src/playground/rendering/debugUtils.ts` with explicit `process.env.NODE_ENV !== 'production'` checks.
*   **Impact**: Even if a developer accidentally commits `debug=true`, the code is dead-stripped or essentially a no-op in production builds.
*   **Coverage**:
    - `graphRenderingLoop.ts`: Performance counters.
    - `graphDraw.ts`: `drawHoverDebugOverlay`, `drawPointerCrosshair`.

### B. Stabilized Render Passes
*   **Change**: Explicitly structured `graphRenderingLoop` into 5 numbered passes:
    1.  **Background & Vignette**: State reset, single draw.
    2.  **Edges**: Batched single-stroke.
    3.  **Nodes**: Iterated draw (optimized).
    4.  **Labels**: Batched text setup.
    5.  **Overlays (Debug)**: Gated.
*   **Impact**: Prevents "interleaving" of state changes (e.g. text -> line -> text -> line) which is the worst case for canvas performance.

### C. State Optimization
*   **Node Loop**: Cleaned up `ctx.save/restore` logic in Phase 1 & 2. Phase 3 enforced the pass structure to ensure `drawNodes` starts with a clean slate.

## 3. Verification
*   **Code Review**: Verified that `isDebugEnabled` is called before any potentially expensive debug logic.
*   **Safety**: All debug calls wrap early returns.

## 4. Files Modified
*   `src/playground/rendering/debugUtils.ts`: [NEW] Gating utility.
*   `src/playground/rendering/graphDraw.ts`: Gated debug overlays.
*   `src/playground/rendering/graphRenderingLoop.ts`: Gated perf logging, structured render passes.

## 5. Next Steps
*   Profile `drawNodes` deeper if we hit 4000+ nodes. The next step would be instanced rendering (WebGL) or further splitting "Glows" from "Cores" into separate loops to minimize `fillStyle` switches.
