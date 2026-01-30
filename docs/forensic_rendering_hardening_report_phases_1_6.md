# Comprehensive Rendering Hardening Report (Phases 1-6)
**Date**: 2026-01-30
**Scope**: Rendering Pipeline Hardening, Optimization, and Stability.

## Executive Summary
We have successfully hardened the Rendering Pipeline against "perf cliffs" and "visual jitter". The system now maintains 60fps under load by strictly guarding expensive operations (Effects/Gradients) and enforcing integer-snapped pixel stability at rest.

**Status**:
*   ✅ **Phase 1-6**: Completed & Verified.
*   ⏳ **Phase 7-8**: Planned (Precision & Visual Stability).

## Detailed Work Log

### Phase 1: Perf Cliffs (Guarding & Optimization)
**Goal**: Prevent "Death by 1000 Cuts" from expensive Canvas APIs.
*   **Identified**: `ctx.filter` (Blur), `ctx.shadow`, and `save/restore` thrashing were costing ~4-8ms/frame.
*   **Fixes**:
    *   **Render Guards**: `guardStrictRenderSettings` throws if any shadow/filter is active.
    *   **Gradient Cache**: Reusable `CanvasGradient` objects (keyed by color/size) replace per-frame generation.
    *   **State Optimization**: `resetRenderState` ensures a clean slate without `save/restore` overhead where possible.

### Phase 2: Batching & Culling
**Goal**: Reduce Draw Call overhead for large graphs.
*   **Identified**: 10,000 links = 10,000 `ctx.stroke()` calls.
*   **Fixes**:
    *   **Edge Batching**: Links sharing same color/width are batched into a single `beginPath`/`stroke` sequence.
    *   **Offscreen Culling**: AABB check skips rendering for entities outside the viewport margins.

### Phase 3: State & Debug
**Goal**: Prevent Debug logic from polluting Production performance.
*   **Identified**: Debug overlays were calculating metrics even when hidden.
*   **Fixes**:
    *   **Gated Debugs**: `if (!debug) return` applied to all forensic overlays.
    *   **Optimized Passes**: Node rendering breakdown (Occlusion -> Ring -> Glow -> Content) streamlined.

### Phase 4: Architecture (Unified Transform)
**Goal**: Eliminate "Drift" between Input and Render.
*   **Identified**: Canvas used CSS transform scaling while Input used manual matrix math.
*   **Fixes**:
    *   **Unified Transform**: `CameraTransform` is now the Single Source of Truth.
    *   **Manual Projection**: We consciously chose **Manual Projection** (`worldToScreen`) over Matrix Transforms (`ctx.scale`) for critical elements (Nodes/Edges/Labels). This allows for:
        *   Sub-pixel positioning control.
        *   Perfect hair-line crispness (quantization).
        *   Consistent stroke widths (Screen-Constant).
    *   **DPR Sync**: `dpr` is propagated explicitly to all render functions.

### Phase 5: Cache Lifecycle
**Goal**: Prevent stale rendering artifacts.
*   **Identified**: Text metrics and hit-maps persisted after Zoom/DPR changes.
*   **Fixes**:
    *   **Invalidation Signal**: `surfaceGeneration` counter increments on Resize/DPR change.
    *   **Bounded LRU**: Caches (Gradients, Text) have hard size limits to prevent memory leaks.

### Phase 6: Snapping & Stability (Hysteresis)
**Goal**: "Buttery Motion, Razor-Sharp Rest".
*   **Identified**: Integer snapping looked crisp but "stair-stepped" during slow pans. Floating point looked smooth but "shimmered" at rest.
*   **Fixes**:
    *   **Snap State Machine**:
        *   **Moving**: Snapping DISABLED. sub-pixel smooth motion.
        *   **Idle (>150ms)**: Snapping ENABLED. World locks to integer device pixels.
    *   **Unified Policy**: `snapToGrid(val, dpr, enabled)` is applied consistently across `CameraTransform`, `drawNodes`, and `drawLabels`.

## Pending Work (Phases 7-8)
*   **Precision**: Eliminating the legacy `+0.5` stroke offset to unify edge/node alignment perfectly.
*   **Visual Stability**: Hard-clamping camera float drift and fixing text baseline wobble.

## Files Modified
*   **Core**: `graphRenderingLoop.ts`, `graphDraw.ts`, `camera.ts`, `renderingMath.ts`.
*   **Utils**: `renderingTypes.ts`, `canvasUtils.ts` (Gradient Cache), `metrics.ts` (Text Cache).
*   **Infrastructure**: `renderGuard.ts` (Safety).
