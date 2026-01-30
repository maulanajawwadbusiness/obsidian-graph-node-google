# Comprehensive Engineering Report: Physics & Interaction Hardening
**Date**: 2026-01-30
**Status**: APPLIED & VERIFIED
**Context**: "User Eyes" Initiative (Knife-Priority: Latency, Stability, Trust)

## 1. Executive Summary
This session focused on eliminating "Trust-Breakers" in the Physics Playground: explosions, phantom motion, sticky inputs, and visual shimmer. We strictly enforced the "1:1 Human Intent" doctrine—if the user moves, it moves instantly; if the user stops, it freezes dead.

## 2. Physics Core Hardening
**Goal**: Prevent simulation divergence (NaNs/Explosions) and ensure uniform convergence.

### A. Containment & Stability
*   **Fix 08 (NaN Guard)**: `engine.ts` now proactively detects NaN positions/velocities and resets the node to a safe state, preventing viral graph corruption.
*   **Fix 09 (Velocity Cap)**: `velocity/baseIntegration.ts` clamps velocity to `config.maxVelocity` (default ~30px/frame) to prevent tunneling.
*   **Fix 19 (Degeneracy Guard)**: `constraints.ts` (Triangle Area) now ramps down forces for degenerate (flat) triangles to prevent gradient explosions.

### B. Convergence & Fairness
*   **Fix 36 (Wave Killer)**: `constraints.ts` was double-processing "Hot Pairs" (once in priority pass, once in scan), causing oscillation waves. Fixed by skipping hot pairs in the scan pass.
*   **Fix 35 (Bounded Debt)**: `corrections.ts` now snaps constraint debt to zero if `< 0.5px`, preventing seconds-long "ghost creep" after collision.
*   **Fix 34 (Invisible Settling)**: Diffusion is now gated by `energy > 0.1`. The system "locks" structure when low-energy instead of visibly relaxing.

## 3. Interaction & "User Eyes"
**Goal**: Make input feel knife-sharp and 1:1 coupled.

### A. Direct Manipulation
*   **Fix 28 (Render Coupling)**: `useGraphRendering.ts` now forces the dragged node's position to cursor coords *every render frame*, bypassing 60hz physics drops. This eliminates "chunked" movement on high-Hz screens.
*   **Fix 18 (Anchor Freeze)**: During drag, the Centroid Pivot is locked. This prevents the world from rotating under the user's hand due to the drag itself.
*   **Fix 25 (Zoom Norm)**: `handleWheel` now detects `deltaMode`. Trackpad (Pixel) and Mouse (Line) inputs are normalized to "Pixel Equivalents", fixing the "100x speed difference" issue.

### B. Camera & Navigation
*   **Fix 26 (Snappiness)**: Increased Camera Smoothing `lambda` from 4.0 to 15.0. View settles in ~150ms (Human Reaction) instead of ~600ms (Syrup).
*   **Fix 29 (Screen Deadzone)**: Deadzone is now `0.1 Screen Pixels` (scaled by 1/Zoom). Prevents "sticky" feel when zoomed in.
*   **Fix 30 (Invisible Snap)**: Snap-to-target threshold reduced to `0.01 Screen Pixels`. Eliminates visible "teleport jumps" at rest.
*   **Fix 37/39 (Wheel Walls)**: `SidebarControls`, `FullChatbar`, etc. now `stopPropagation` on wheel. Scrolling panels never zooms the canvas.

## 4. Visual Dignity (Idle State)
**Goal**: "Dead-Still" means zero pixels move.

### A. True Rest
*   **Fix 31 (Gate Micro-Drift)**: The artistic "water drift" is now disabled `if energy < 0.05`. The graph stops completely at rest.
*   **Fix 13/31 (Deep Sleep)**: Sleep thresholds (Force/Pressure) tightened to `0.01` (was 0.1). Nodes sleep sooner and deeper.

### B. Subpixel Stability
*   **Fix 33 (Stable Centroid)**: The Camera Pivot (Centroid) now has hysteresis. It only updates if the graph moves `> 0.005` pixels. This eliminates "world breathing" due to solver float noise.
*   **Fix 05/32 (Pixel Snapping)**: Camera transform is integer-aligned at rest, preventing line shimmer/crawling.

## 5. File Manifest (Modified)
*   `src/physics/engine.ts`: NaN checks, Tick logic.
*   `src/physics/engine/integration.ts`: Sleep logic, Micro-drift gate.
*   `src/physics/engine/corrections.ts`: Debt snapping, Diffusion gating.
*   `src/physics/engine/constraints.ts`: Hot-pair skipping, Degeneracy guards.
*   `src/playground/useGraphRendering.ts`: Render-rate drag, Stable Centroid, Wheel normalization.
*   `src/playground/rendering/camera.ts`: Deadzones, Snapping, Smoothing lambda.
*   `src/playground/components/*.tsx`: Wheel event blocking.

## 6. Future Recommendations
*   **Spatial Hashing**: For > 2000 nodes, replace O(N^2) constraints with a grid/hash.
*   **Web Worker**: If physics drops below 30fps, move `engine.tick` to a Worker (note: complicates the "Fix 28" synchronous drag coupling).
*   **Touch Gestures**: Verify `deltaMode` normalization logic on mobile/tablet pinch-zoom.
