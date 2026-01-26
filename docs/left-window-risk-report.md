# Left Window (Half-Screen Viewer) - Risk Scan & Fix Plan

This report dissects the current code paths that will cause issues when introducing a **left half-screen window** (document viewer placeholder now, real viewer later). It identifies where problems will arise, why, and a sharp plan to recognize and fix them.

---

## Root Causes / Where Problems Will Rise

### 1) Hover can "stick" after layout changes (open/close left window)

**Why it happens**
- Hover selection updates are driven by **pointer movement** and **camera changes**.
- When the left window opens, the canvas `getBoundingClientRect()` changes because `MAIN_STYLE` shrinks, but there is no explicit "layout changed" signal to clear or recompute hover state.

**Where it happens**
- Hover update trigger logic: `src/playground/useGraphRendering.ts:158` (cameraChanged gating) and `src/playground/useGraphRendering.ts:171` (pending pointer drives selection).
- Layout-dependent rect read: `src/playground/useGraphRendering.ts:119` (`const rect = canvas.getBoundingClientRect();`).
- Hover clearing currently only occurs for pointer leave/cancel/up and window blur; there's no "resize/layout change" clear.

**Symptoms**
- Open left window while cursor was previously over canvas: hover energy/highlight may remain active even though the cursor is now over the left window (without moving) or canvas dimensions changed.

---

### 2) Toggle visibility is gated on document readiness (must be removed)

**Why it happens**
- The current bottom-left toggle is hidden unless a document exists and `status === 'ready'`.

**Where it happens**
- `src/playground/components/TextPreviewButton.tsx:30` returns `null` unless `state.status === 'ready' && state.activeDocument`.

**Symptoms**
- The left window cannot be opened with no document loaded (not allowed per clarified requirements).
- If `previewOpen` remains true but the document is cleared, you can end up with "open viewer but no visible toggle".

---

### 3) Drag/drop parsing is attached to the MAIN canvas container only

**Why it happens**
- Drag/drop handlers (`onDragOver`, `onDrop`) exist on the canvas container (`MAIN_STYLE`), not on the overall app container.
- When the left window becomes a flex sibling, drops on the left window won't be caught.

**Where it happens**
- `src/playground/GraphPhysicsPlayground.tsx:207` (drag/drop handlers).

**Symptoms**
- Dragging a file onto the left window area does nothing unless you intentionally support or intentionally block that path.

---

### 4) Fixed overlays (debug panel) can sit above the left window and steal input

**Why it happens**
- Debug overlay uses `position: fixed` with a very high `zIndex`.
- A left window implemented as a flex sibling won't be "above" fixed overlays by default.

**Where it happens**
- `src/playground/graphPlaygroundStyles.ts:40` (`DEBUG_OVERLAY_STYLE` uses `position: 'fixed'`, `zIndex: 999999`).

**Symptoms**
- Debug UI can float over the left viewer and steal pointer interactions (contradicts the requirement that the left window owns pointer input in its area).

---

### 5) Popup positioning assumes full viewport width (ignores left window)

**Why it happens**
- Popup computes placement against `window.innerWidth` and `window.innerHeight`.
- With a left window open, the "usable" area for popups is effectively the right region; current logic may still position into the left region.

**Where it happens**
- `src/popup/NodePopup.tsx:87` (`computePopupPosition` uses `window.innerWidth/innerHeight`).

**Symptoms**
- Popups can overlap the left viewer. This can be fine visually, but it becomes a product decision once the left side is a reading surface.

---

### 6) Popup "click outside" behavior will treat left window clicks as outside-clicks

**Why it happens**
- Popup registers a `document.addEventListener('mousedown', ...)` to close if click target is outside the popup.
- Clicking inside the left window will close the popup.

**Where it happens**
- `src/popup/NodePopup.tsx:147` (document mousedown listener).

**Symptoms**
- Popup will close when interacting with the viewer. This may be acceptable, but it must be a deliberate UX choice.

---

### 7) `previewOpen` persists across `CLEAR_DOCUMENT` (risk of "open, but empty" viewer)

**Why it happens**
- Reducer preserves `previewOpen` when clearing the document.

**Where it happens**
- `src/store/documentStore.tsx:51` returns `{ ...initialState, previewOpen: state.previewOpen }`.

**Symptoms**
- Viewer can stay open after clearing a doc and show an empty state; combined with toggle gating, it can become hard to close.

---

## Fix Plan (Detailed + Sharp)

### A) Lock the clarified UX invariants (prevents rework)

These are clarified requirements for this phase:
- **Toggle visibility:** viewer must open even with no document loaded; show a clear empty state ("no document loaded") with no errors.
- **Hover on open:** when viewer opens, hover highlights must clear (must not freeze/stick).
- **Drop behavior:** drag/drop onto the left window is intentionally blocked; only the canvas/right area handles parsing.
- **Overlays:** debug overlay and popups remain above everything, but must not steal pointer input from the left window area (popups only capture input where they visually overlap).

---

### B) Implement layout safely (split view as siblings)

1. In `src/playground/GraphPhysicsPlayground.tsx:325`, render the left window component **as a sibling** before the main canvas container.
2. Keep the main canvas container as the "right region" with `flex: 1`.
3. Prefer `flex: 0 0 50%` for the left window rather than `50vw` to avoid scrollbar-vw drift.

**Recognition tests**
- Canvas resizes to right half instantly.
- No horizontal overflow.

---

### C) Fix hover correctness on open/close (layout change => hover clear)

**Goal:** Opening/closing viewer should never leave stale hover state, even if the pointer does not move.

1. Expose a `clearHover()` function from the rendering hook:
   - `createHoverController` already returns `clearHover`; `useGraphRendering` currently doesn't re-export it.
2. In `src/playground/useGraphRendering.ts:272`, include `clearHover` in the returned object.
3. In `src/playground/GraphPhysicsPlayground.tsx:325`, call `clearHover('viewer toggle', -1, 'unknown')` when toggling viewer open/close (or right after state change in an effect).

**Note**
- Do not rely on "pointer events are blocked on the left side" to clear hover. If the viewer opens under a stationary cursor (common), the canvas may not receive a leave/move event, so hover can remain unless explicitly cleared.

**Recognition tests**
- Open viewer while cursor is stationary over a hovered node: hover clears immediately (no stuck glow).
- Close viewer: hover behaves normally with next pointer move.

---

### D) Enforce pointer ownership in the left window

Even as a sibling, add "membrane" handlers so you never depend on bubbling order:
- On the left window root:
  - `onPointerDownCapture`, `onPointerMoveCapture`, `onPointerUpCapture`, `onPointerCancelCapture`: `stopPropagation()`
  - `onWheelCapture`: `stopPropagation()` + `preventDefault()` (avoid canvas zoom/pan if any exists now or later)
  - optional `onContextMenu`: `preventDefault()` + `stopPropagation()`
- Add `style={{ pointerEvents: 'auto', touchAction: 'pan-x pan-y' }}` and ensure there are no transparent gaps.

**Recognition tests**
- Move mouse inside left window: no hover changes.
- Scroll inside left window: canvas doesn't react.
- Click/drag inside left window: no node drag, no popup open.

---

### E) Drag/drop policy (this phase: intentionally blocked)

**Requirement:** drag/drop onto the left window is blocked and must not parse.
- Call `preventDefault` on `dragover`/`drop` in the left window and do not call `documentContext.parseFile`.
- Optional: show inline helper text like "Drop files on the canvas to load" so the blocked behavior is explicit.

**Recognition tests**
- Dropping a file on the left window never parses; dropping on the canvas/right area still parses.

---

### F) Overlay layering fix (debug + popups must not steal left-window pointer input)

Because `DEBUG_OVERLAY_STYLE` is fixed at `zIndex: 999999`, pick a strategy that satisfies:
- Debug overlay stays visually above, but must not steal pointer input from the left window area.

Practical options:
- **Reposition debug overlay into the right region when viewer is open** (recommended), or
- **Place debug overlay top-right** (so it cannot overlap the left half), or
- Avoid placing any fixed interactive UI inside the left half while the viewer is open.

Popups:
- Portal container already uses `pointerEvents: 'none'` and children use `pointerEvents: 'auto'` (`src/popup/PopupOverlayContainer.tsx:16`), which matches the requirement "popups only capture input where they overlap".

**Recognition tests**
- With viewer open, moving/clicking inside the left window is never intercepted by debug UI.
- Popups remain usable where they visually overlap (and only there).

---

### G) Popup placement policy (product decision)

If you don't want popups to cover the left viewer:
- Change popup positioning to use a "usable viewport rect" (right region bounds) rather than `window.innerWidth`.

If you don't mind overlap:
- Keep current behavior, but verify pointer-event rules are preserved (left window should still own pointer except where popup visually overlaps).

**Recognition tests**
- Open viewer and open a popup; popup behavior matches the chosen policy.

---

### H) State semantics cleanup (avoid "open but empty, cannot close")

1. If you keep `previewOpen` as viewer-open state:
   - Keep viewer open even when no document exists (empty state), but ensure there is always a visible close path (toggle and/or close button in header).
2. Remove toggle gating:
   - Do not hide the toggle when `activeDocument` is null; instead, open viewer into the empty state.

**Recognition tests**
- No combination of states can make the viewer open with no visible close path.

---

## Practical Debug Checklist (When Implementing)

- Toggle open with no document loaded: viewer opens and shows a clear "no document loaded" empty state.
- Open viewer while hovering a node (cursor stationary): hover clears immediately (no stuck glow).
- Pointer/scroll in viewer never affects canvas (hover, drag, popup open).
- Drag/drop on viewer is blocked and does not parse (only right/canvas parses).
- Debug overlay and popups remain above, but do not steal pointer input from the left window area (popups capture only where they overlap).

