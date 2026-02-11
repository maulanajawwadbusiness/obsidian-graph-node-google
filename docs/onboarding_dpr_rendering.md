# Arnviod Rendering & DPR Doctrine
**Version**: 1.0 (Hardened 2026-01-30)
**Audience**: Coding Agents & Renderer Engineers

> **The Single Truth**: We render "Retina-First". The canvas backing store is always `round(CSS_Width * DPR)`. We rely on a single Unified Transform (`CameraTransform`) for all coordinate mapping. We never trust browser events blindly—we sanitize, debounce, and re-project everything inside the Render Loop.

---

## 1. The Mental Model: Three Spaces
You must distinguish these three coordinate systems at all times. Mixing them results in blurry text, drift, or offset clicks.

### A. Client Space (CSS Pixels)
*   **Unit**: Virtual CSS Pixels.
*   **Origin**: Top-left of the viewport (usually `(0,0)`).
*   **Used For**: `pointerEvent.clientX`, `rect.left`, `rect.width`.
*   **Cardinal Rule**: This is the "User's Screen Surface". The browser layout engine lives here.

### B. Device Space (Physical Pixels)
*   **Unit**: Real Hardware Pixels.
*   **Relation**: `Device = CSS * window.devicePixelRatio`.
*   **Used For**: `canvas.width` (backing store), `gl.viewport`, `ctx.lineWidth` (sometimes).
*   **Cardinal Rule**: We draw here. The `<canvas>` backing store MUST match this exactly to look sharp.

### C. World Space (Simulation Units)
*   **Unit**: Arbitrary infinite plane units (typically 1 unit ≈ 1 CSS pixel at zoom=1).
*   **Origin**: `(0,0)` is the center of the graph universe.
*   **Used For**: Node positions `(x,y)`, Physics Forces, Camera Pan.
*   **Cardinal Rule**: Interaction Logic lives here. We project Input -> World to find targets.

---

## 2. The Canonical Pipeline
We do NOT use `ResizeObserver` to trigger draws. We check the surface **inside the rAF loop**.

### Step 1: Surface Hygiene (Every Frame)
1.  **Read Rect**: `rect = canvas.getBoundingClientRect()` (CSS Space).
2.  **Safety Guard**: If `rect.width <= 0`, **RETURN IMMEDIATELY**. Do not update camera, do not draw.
3.  **Read DPR**: `dpr = safeGetDpr()` (Sanitized, Clamped [0.1, 8.0], Debounced).
4.  **Compute Backing**:
    ```typescript
    const displayWidth = Math.max(1, Math.round(rect.width * dpr));
    const displayHeight = Math.max(1, Math.round(rect.height * dpr));
    ```

### Step 2: Sync & Reset
1.  **Compare**: `if (canvas.width !== displayWidth || ...)`
2.  **Resize**: If mismatched, set `canvas.width = displayWidth`.
3.  **Flag**: Set `surfaceChanged = true` (Triggers accurate hover-test later).
4.  **Transform**: Immediately reset context scale to match CSS units:
    ```typescript
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ```
    *Why?* This allows us to issue Draw Commands in **CSS Pixels** (easier math) while the Browser paints them to **Device Pixels** (sharpness).

### Step 3: Snapshot
1.  **Sanitize Camera**: Check `zoom/pan` for `NaN`. Revert to `lastSafeCameraRef` if corrupt.
2.  **Create Transform**: Instantiate `new CameraTransform(...)`.
    *   This object is the **Source of Truth** for the entire frame.
    *   It contains the `rect`, `dpr`, `camera`, and `angle`.

### Step 4: Draw & Input
1.  **Draw**: Use `transform.worldToScreen()` (or manual projection) to place nodes.
2.  **Input**: If a pointer is active, use `transform.clientToWorld(clientX, clientY, rect)` to update drag targets. **Do not use stale transforms.**

---

## 3. "Never Blank The Map" Doctrine
We aggressively prevent white flashes or disappearing graphs.

1.  **Zero-Size Guard**: If the panel collapses (`width=0`), we **SKIP** the frame logic. We do **NOT** resize the canvas to 0. The last valid frame remains visible on the canvas until the panel expands again.
2.  **NaN Guard**: If `camera.zoom` becomes `0` or `NaN` (div-by-zero bug), the render loop detects it **before** drawing and restores `lastSafeCamera`. The user sees nothing; the frame is repaired instantly.
3.  **DPR Fallback**: If `devicePixelRatio` reports `0` (headless/iframe bug), we force `1.0`.

---

## 4. DPR Edge Cases (Handled)
*   **Fractional DPR**: Monitors with 125% scaling report `dpr=1.25`. We use `Math.round(rect * dpr)` to ensure the backing store is an integer.
*   **Monitor Hot-Swap**: Dragging a window between screens causes DPR to "flap" (e.g. 1.0 -> 1.5 -> 1.0 -> 1.5).
    *   **Fix**: We use a **4-Frame Debounce**. The renderer holds the old DPR until the new value is stable for ~60ms.
*   **Zoom Storm**: Ctrl+/- triggers rapid resize events. We coalesce these into a single update per frame via the rAF check.

---

## 5. Overlay Rules (Strict)
DOM Overlays (like Labels or Popups) must move in perfect sync with the Canvas.

1.  **No Independent Loops**: Overlays must NOT run their own `requestAnimationFrame` or `getBoundingClientRect`.
2.  **Tick Synchronization**: Overlays should position themselves via a callback/signal fired **immediately after** the canvas draw phase (e.g. `useLayoutEffect` or `graph-render-tick`).
3.  **Same Transform**: Overlays must use the **exact same** `forwardProjection` logic (including snapping) as the canvas.
4.  **Pointer Events**: Overlays (unless interactive) must be `pointer-events: none`. If interactive (buttons), they must `stopPropagation` to prevent Graph Drag.

---

## 6. Pixel Snapping Contract
To look "Native", we avoid anti-aliasing fuzz on thin lines.

1.  **Snap Post-Projection**: Never snap World Coordinates. Project to Screen Space, *then* snap.
2.  **Quantization Formula**:
    ```typescript
    // Snap to nearest Physical Pixel
    screenX = Math.round(screenX * dpr) / dpr;
    ```
3.  **Stroke Alignment**:
    *   Odd Width (1px): Snap to `N.5` pixels (center of pixel).
    *   Even Width (2px): Snap to `N.0` pixels (boundary).
    *   Use `quantizeForStroke(val, width, dpr)`.

---

## 7. Anti-Patterns (Do Not Do This)
*   ❌ **World Snapping**: `worldX = Math.round(worldX)`. Causes "staircase" movement during zoom.
*   ❌ **Double Read**: Calling `rect = canvas.getBoundingClientRect()` inside `onPointerMove`. kills performance. Use `cachedRect`.
*   ❌ **Resize to 0**: `canvas.width = 0`. Wipes the GL context and flashes white.
*   ❌ **Live Camera**: `cameraRef.current.panX` inside the draw loop. Use the `transform` snapshot created at loop start. Camera ref might mutate mid-frame (input events).

---

## 8. Verification Playbook

### A. The "Sharpness" Test
1.  Open the graph on a high-DPI screen (MacBook/Surface).
2.  Text and 1px lines should look **razor sharp**, not fuzzy.
3.  Set Browser Zoom to 110%. Lines should remain sharp (backing store resizes).

### B. The "Integrity" Test (Knife Test)
1.  Enable `debugPerf`.
2.  Drag a node widely.
3.  Verify `[KnifeTest]` logs show drift `< 0.0001px`.
4.  If drift is high, the Input Transform and Render Transform have desynced (Logic Bug).

### C. The "Storm" Test
1.  Grab the window title bar.
2.  Shake it violently between two monitors with different scaling.
3.  The graph should **not** flicker or go blank.
4.  Release. It should snap to the new sharpness instantly.
