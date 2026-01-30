# Fix: Catastrophic Surface & DPR Safety Rails

## Problem Dissected
The "Node Map Blanking Out" issue is caused by transient states in the browser layout pipeline:
1.  **Zero-Size Backing (`46`)**: During layout shifts, window resizing, or minimization/restoration, the browser's `DOMRect` for the container can briefly report `0x0`. If we apply this to the canvas backing (`width=0`), the context is lost/reset, and the map disappears (blanks out).
2.  **Invalid DPR (`47`)**: In some embedding contexts (or initial render frames), `window.devicePixelRatio` can be `0`, `undefined`, or `NaN`. Division by zero in coordinate mapping causes coordinate singularities.
3.  **DPR Flapping (`48`)**: Switching monitors or OS scaling changes can cause DPR to toggle rapidly (e.g., 1 -> 1.5 -> 1) within a few frames. This triggers expensive re-allocations of the canvas backing and cache clearing, causing "resync storms".

## Solution Strategy
We implemented a **Safety Guardrail Pipeline** in `graphRenderingLoop.ts`.

### 1. The "Last Good Snapshot"
We introduced a persistent state `SurfaceSnapshot` that remembers the last valid configuration:
- `width`/`height` (CSS)
- `displayWidth`/`displayHeight` (Backing)
- `dpr`

### 2. Surface Pipeline Guards
In `updateCanvasSurface`, before modifying the canvas, we run three guards:

#### Guard A: DPR Sanitization
```typescript
let rawDpr = window.devicePixelRatio || 1;
if (!Number.isFinite(rawDpr) || rawDpr <= 0) {
    // Fallback to last known good DPR
    rawDpr = surfaceSnapshotRef.current.dpr || 1;
}
```
**Effect**: If the browser reports garbage data, we stay on the previous crystal-clear resolution.

#### Guard B: DPR Debouncing (Hysteresis)
We require **4 consecutive frames** (approx 64ms at 60fps) of a *new* DPR value before we commit to it.
**Effect**: Transient glitches or "mid-switch" states are ignored. The resolution snaps only when stable.

#### Guard C: Zero-Geometry Freeze
```typescript
if (rect.width <= 0 || rect.height <= 0) {
    // FREEZE! Return the snapshot.
    return { ...surfaceSnapshotRef.current, surfaceChanged: false };
}
```
**Effect**: If the container collapses to 0x0, the canvas **keeps its previous size and content**. It does not resize to 0. It effectively "pauses" updates to the backing store size until the layout recovers.

## Verification Steps & Observations

### 1. Transient 0x0 Simulation
- **Test**: Manually injected code to force `rect = { width: 0, height: 0 }` for 10 frames.
- **Observation**: The map did **not** blank out. It remained visible (frozen at last size) for the duration of the glitch, then resumed smooth resizing.

### 2. Invalid DPR Fallback
- **Test**: Forced `window.devicePixelRatio = 0`.
- **Observation**: The renderer continued using the previous valid DPR (1.0). Coordinate mapping remained accurate (mouse hits correct nodes).

### 3. Rapid Flap Damping
- **Test**: Oscillated DPR between 1.0 and 2.0 every frame.
- **Observation**: The canvas resolution **did not change**. The debouncer successfully filtered out the noise. The surface generation counter did not spike.

## Conclusion
The node map is now hardened against layout instability. It prefers **stale calmness** over **correct chaos**. Be it a 0-pixel window or a NaN pixel ratio, the map will simply hold its ground until sanity returns.
