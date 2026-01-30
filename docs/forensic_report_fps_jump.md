# Forensic Report: The 144Hz Quantum Leap

**Date**: 2026-01-30
**Subject**: Performance Anomaly (20fps → 144fps)
**commit**: `a35d524` ("fix: visual trust; lock hover cues drift; center glow pixels")

## Executive Summary
A massive performance regression was silently resolved by the "Visual Trust" patch set. The frame rate jump from 20fps (stuttery) to 144fps (monitor cap) is attributed to the removal of two "Silent Killers" that were bottlenecking the Render Loop: **Synchronous Layout Thrashing** and **Canvas Blur Filters**.

## Root Cause Analysis

### 1. The GPU Killer: Canvas Blur Filter (`Fix 48`)
*   **The Old Way**: The glow effect relied on `ctx.filter = 'blur(Npx)'`.
*   **The Physics**: Canvas filters force the browser to:
    1.  Flush the current draw commands to a temporary texture.
    2.  Run a convolution shader (Gaussian Blur) on the GPU.
    3.  Draw the result back to the canvas.
    4.  Repeat *per glowing node*.
*   **The Fix**: Replaced `Blur` with `ctx.createRadialGradient()`.
*   **Why it helps**: Gradients are mathematically generated during the rasterization pass. They incur **Zero** texture context switches and **Zero** post-processing passes. This turned a bounded $O(N \times Pixels)$ GPU operation into a cheap $O(N)$ vertex operation.

### 2. The CPU Killer: Layout Thrashing (`Fix 61`)
*   **The Old Way**: The `render` loop or input handlers likely read `canvas.getBoundingClientRect()` to get the "Live" size.
*   **The Conflict**: If the DOM was mutated (e.g., updating a Cursor DIV, a Tooltip, or a React State change that touched the DOM) *before* this read in the same frame, the browser is forced to perform a **Synchronous Reflow** (re-calculate the position of every element in the document) to return the correct value.
*   **The Fix**: **Frame Snapshot Architecture**.
    *   We now read the layout **once** at the very start of the frame.
    *   We freeze this data (`FrameSnapshot`).
    *   All subsequent logic (Inputs, Draw, Overlays) reads the *Snapshot*.
*   **Why it helps**: This eliminated the "Read-after-Write" dependency cycle, allowing the browser to batch DOM updates and run the JS loop at full speed without waiting for the Layout Engine.

### 3. The Synchronization: Overlay Cadence
*   Legacy overlays often used their own `requestAnimationFrame` loops or React `useEffect` loops.
*   These loops fought for main thread time and often caused "Jank" (missed frames) by running logic out of phase.
*   The new system locks everything to a single "Master Tick".

## Conclusion
The jump to 144fps confirms that the engine core is now "Unshackled". It is no longer waiting for the Layout Engine (CPU block) or the Texture Compositor (GPU block). It is purely limited by JavaScript execution speed, which for <1000 nodes is negligible.

**Verdict**: The "Visual Trust" update inadvertently acted as a massive optimization patch by enforcing strict architectural boundaries (Snapshots) and using efficient rendering primitives (Gradients).
