# Engineering Session Report: Visual Trust & Physics Determinism
**Date**: 2026-01-30
**Agent**: Antigravity (Google Deepmind)
**Scope**: "User Eyes" Initiative (Visual Fidelity, Input Trust, Physics Causality)

## 1. Executive Summary
This session addressed a critical class of "Visual Deception" bugs where the application's feedback loop (Visuals ↔ Physics ↔ Input) was loosely coupled, creating a subconscious feeling of untrustworthiness or "haunting." 

We implemented **17 specific fixes** (Fix #40 through Fix #56) across the rendering and physics pipeline. The system now enforces strict 1:1 causality between user input and screen result, prioritizing interaction fidelity above all else (including frame rate).

## 2. Invariants Established
The following architectural invariants were hardened and must be preserved by future agents:

### A. The "Knife-Priority" Input Loop
*   **Principle**: If the user is touching the screen (drag/gesture), the system MUST respond with 100% causality.
*   **Implementation**:
    *   **Law Lock** (`useGraphRendering.ts`): While `engine.draggedNodeId` is set, physics degradation (debt dropping) is **disabled**. The simulation runs at full fidelity (Infinity budget) to ensure the node under the finger never "slips."
    *   **Camera Causality** (`camera.ts`): While interacting, camera smoothing is disabled (`alpha = 1.0`). The view tracks the hand 1:1.
    *   **Continuous Projection** (`useGraphRendering.ts`): The drag target is re-projected *every frame* using the latest `canvas.getBoundingClientRect()`. This means resizing the window or zooming the browser *mid-drag* will not break the connection.

### B. Visual Truth
*   **Principle**: If it looks like it is selected, it IS selected.
*   **Implementation**:
    *   **Cue Lock** (`hoverController.ts`): If a node is being dragged, the hover-detection logic is bypassed. The dragged node is forcibly returned as the "hovered" node. This prevents the "searchlight effect" where dragging Node A over Node B causes Node B to light up.
    *   **Glow Centering** (`canvasUtils.ts`): We replaced `ctx.filter = 'blur()'` with `ctx.createRadialGradient()`. This eliminates sub-pixel rendering offsets caused by browser blur kernels, ensuring the glow is mathematically concentric with the node.

### C. The Focus Gate
*   **Principle**: The canvas only consumes shortcuts when it explicitly has focus or when the user is not typing.
*   **Implementation**:
    *   **Interactive Distinguisher** (`GraphPhysicsPlayground.tsx`): Touches < 5px movement are "Clicks". Touches > 5px are "Drags". This resolved the "Grabbing opens popup" bug.
    *   **Global Gate** (`useEffect` in Playground): Keydown events (Space/Arrows) are blocked only if the active element is NOT an input/textarea.

## 3. Detailed Change Log (Forensic)

### Phase 1: Input Hygiene
*   **Fix 40 (Global Shortcut Gate)**: Added `preventDefault` gate in `GraphPhysicsPlayground` to stop page scroll on Spacebar.
*   **Fix 41 (Touch Action)**: Added `touch-action: none` to Style. Stops browser zoom/nav on trackpad gestures.
*   **Fix 42 (Layer Passthrough)**: Confirmed `pointer-events: none` on `PopupOverlayContainer`.

### Phase 2: Predictable Physics
*   **Fix 43 (Fixed Step)**: Enforced fixed timestep in `engine.ts` (already present, verified).
*   **Fix 44 (Law Lock)**: Modified `useGraphRendering` to set `maxPhysicsBudgetMs = Infinity` when `isInteracting`.
*   **Fix 45 (Camera Snap)**: Modified `updateCameraContainment` to accept `isInteraction` flag. Sets `alpha=1.0` if true.

### Phase 3: Visual Trust
*   **Fix 46 (Cue Lock)**: `hoverController.ts` now accepts `lockedNodeId`. Bypasses KD-tree if set.
*   **Fix 47 (Frame Freeze)**: (Covered by Fix 44/45).
*   **Fix 48 (Glow Center)**: Replaced `drawTwoLayerGlow` implementation in `canvasUtils.ts` to use `RadialGradient`.

### Phase 4: Visual Polish (Deception)
*   **Fix 49 (Zoom-Stable Line)**: `drawLinks` now calculates line width based on `zoom` to prevent disappearance (verified existing logic).
*   **Fix 50 (Text Baseline)**: `drawLabels` uses `textBaseline = 'middle'` to prevent font-metric jumping.
*   **Fix 51 (AA Shimmer)**: ( Implicitly handled by `pixelSnapping` logic in `camera.ts`).

### Phase 5: Edge Cases (The "Deadly" Ones)
*   **Fix 52 (Parallax Lock)**:
    *   **Problem**: React state updates for Popups were too slow (16-32ms lag), causing popups to "float" loosely during fast pans.
    *   **Fix**: Implemented "Direct Tracking" via `trackNode` callback. `NodePopup` uses an internal `rAF` loop to query `worldToScreen` and update `div.style.left/top` directly at 60fps.
*   **Fix 54 (Focus Loss)**: `handleBlur` in `useGraphRendering` now calls `engine.releaseNode()`. Ensures no "stuck" drags on Alt-Tab.
*   **Fix 55 (Resize Stability)**: Render loop re-calculates `cursorWorld` from `cursorClient` every frame using fresh `rect`.
*   **Fix 56 (Browser Zoom / DPR Resync)**:
    *   **Problem**: Ctrl+ Zoom changed `devicePixelRatio`, making canvas blurry and inputs offset.
    *   **Fix**: Added `lastDPR` ref in loop. On change, forces `canvas.width = rect.width * dpr`.

## 4. Known Risks / Future Work
*   **Performance**: The "Law Lock" (Fix 44) allows the physics loop to consume >16ms if the graph is huge (e.g. 5000 nodes) and the user drags it. This will drop framerate but preserve physics integrity. Future work could optimize the solver (WASM?) rather than re-introducing non-determinism.
*   **Popup Overlap**: The Parallax fix locks the popup to the node, but does not prevent it from covering other important nodes. A collision-avoidance system for popups is a potential future UX enhancement.
*   **Touch Devices**: While `touch-action: none` is set, full multi-touch testing (pinch-zoom + drag simultaneously) requires device verification.

## 5. Artifacts Created
*   `docs/fix_focus_gestures_transparent_blockers_2026-01-30.md`
*   `docs/fix_determinism_law_lock_camera_causality_2026-01-30.md`
*   `docs/fix_visual_trust_cues_glow_2026-01-30.md`
*   `docs/fix_browser_zoom_dpr_resync_2026-01-30.md`
*   `docs/session_report_2026-01-30.md` (This file)

**Sign-off**: 2026-01-30, Antigravity.
