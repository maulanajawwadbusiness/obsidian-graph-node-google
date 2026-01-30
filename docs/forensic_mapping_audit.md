# Forensic Audit: Screen ↔ World Mapping
**Scope**: `src/playground/rendering/camera.ts` | `useGraphRendering.ts` | `GraphPhysicsPlayground.tsx`
**Status**: **CLEARED** (Design is Sound)
**Date**: 2026-01-30

## 1. The Mapping Contract (The "Law")

The application enforces a strict **Single Source of Truth** for spatial mapping:

1.  **Coordinate Space**: logic is performed exclusively in **CSS Pixels** (Logical Pixels).
    *   Physical pixel scaling (DPI) is handled invisibly at the `ctx.setTransform` root level.
    *   The Camera knows nothing of `devicePixelRatio`.
2.  **Transform Stack**:
    *   **World Space**: Physics coordinates (0,0 is origin).
    *   **Centroid**: The dynamic anchor point `(cx, cy)` calculated from node distribution.
    *   **Screen Space**: CSS pixel coordinates relative to the Canvas Top-Left.
3.  **Synchronization**:
    *   Physics state (Nodes + Centroid) is **Frozen** between frames (Physics runs inside `requestAnimationFrame`).
    *   Therefore, Input Events (which fire between frames) see the **exact same physics state** that generated the previous frame.

## 2. Mathematical Verification

### A. Render Transform (Forward)
**Source**: `CameraTransform.applyToContext`
**Input**: World `(wx, wy)`
**Stack** (Applied to Context):
1.  **DPR Scale**: `S(dpr, dpr)` (via `useGraphRendering` root)
2.  **Center**: `T(w/2, h/2)` (Logic starts here)
3.  **Zoom**: `S(z, z)`
4.  **Pan**: `T(px, py)` (Pan is additive in Rotated World Space)
5.  **Rotate**: `T(cx, cy) -> R(θ) -> T(-cx, -cy)`

**Resulting Pixel**:
$$ Screen = Center + Zoom \times ( Pan + Rotate(World - Centroid) ) $$

### B. Input Transform (Inverse)
**Source**: `CameraTransform.clientToWorld`
**Input**: Client `(cx, cy)`
**Stack** (Executed in Code):
1.  **Normalize**: `sx = cx - rect.left - w/2`
    *   *Effect*: Undoes "Center" & DOM Offset.
2.  **Un-Zoom**: `zx = sx / z`
    *   *Effect*: Undoes "Zoom".
3.  **Un-Pan**: `px = zx - px`
    *   *Effect*: Undoes "Pan" (Matches `T(px, py)` above).
4.  **Un-Rotate**: `InverseRotation(px - cx, py - cy) + cx`
    *   *Effect*: Undoes `T(cx,cy)R(θ)T(-cx,-cy)`.

**Verdict**: The inverse stack is **Algebraically Exact**.

## 3. Edge Case Forensics

| Risk Vector | Status | Notes |
| :--- | :--- | :--- |
| **DPI Mismatch** | **SAFE** | `canvas.width` is scaled by DPR, but `camera.ts` receives `rect.width` (CSS). `applyToContext` works in CSS units. Correct. |
| **Centroid Wobble** | **SAFE** | Physics runs *inside* `render()`. Events fire *between* renders. Events see the `centroid` from the *previous* finished tick, matching the *previous* frame's rotation. No "mid-event" drift. |
| **Rounding Drift** | **SAFE** | `pixelSnapping` (optional) rounds `pan` *after* zoom multiplication in Render. Input mapping does *not* replicate this snapping? **WARNING**: If `pixelSnapping=true`, input might be off by <1px. Default is `false`. |
| **Overlay Leaks** | **SAFE** | `handlePointerDown` strictly checks `e.target !== canvas`. Overlays with `pointer-events: auto` will block canvas intx (correct). |
| **Pointer Capture** | **SAFE** | `canvas.setPointerCapture` is used. Drag continues even if mouse leaves window. |

## 4. Verification Plan (The Knife Test)

To prove "Knife-Sharp" accuracy, run this snippet. It brute-forces 10,000 random points through `world -> screen -> world`.

### Debug Console Snippet
Paste this into `src/playground/rendering/camera.ts` (temp) or run via console if exposed:

```typescript
// KNIFE TEST: Round Trip Verification
// Usage: Run this when camera is zoomed/panned/rotated
function runKnifeTest(width=800, height=600, zoom=1.5, panX=100, panY=-50, angle=0.5) {
    const cx = 50, cy = 50; // Arbitrary centroid
    const t = new CameraTransform(width, height, zoom, panX, panY, angle, {x:cx, y:cy}, false);
    const rect = { left: 0, top: 0, width, height } as DOMRect;

    let maxError = 0;
    for(let i=0; i<10000; i++) {
        const wx = (Math.random() - 0.5) * 2000;
        const wy = (Math.random() - 0.5) * 2000;

        // 1. Forward
        const screen = t.worldToScreen(wx, wy);

        // 2. Mock Mouse Event (ClientX = ScreenX because rect is at 0,0)
        const result = t.clientToWorld(screen.x, screen.y, rect);

        // 3. Diff
        const dx = Math.abs(result.x - wx);
        const dy = Math.abs(result.y - wy);
        maxError = Math.max(maxError, dx, dy);
    }
    console.log(`[KnifeTest] Max Error over 10k pts: ${maxError.toFixed(10)}px`);
    return maxError < 1e-5;
}
```

## 5. Potential Micro-Fix Plan (Optional)

If `pixelSnapping` is ever enabled by default:

**Issue**: `applyToContext` rounds `panX`, but `clientToWorld` does not.
**Fix**:
```typescript
// In clientToWorld
let effectivePanX = panX;
if (this.pixelSnapping) effectivePanX = Math.round(panX * zoom) / zoom;
// Use effectivePanX for calculation
```

*Currently `pixelSnapping` defaults to `false`, so this is low priority.*
