# Prefill System Hardening: Visibility & Resize

## Status
**Completed**. The prefill system is now resilient to background tab throttling, window resizing, and layout changes.

## Policies Implemented

### 1. Visibility (Alt-Tab) Policy: "Snap & Stop"
Browsers aggressively throttle `requestAnimationFrame` and `setTimeout` in background tabs (sometimes to 1s or worse). This causes animations to "jump" or loops to run slow.
- **On Tab Hidden**:
    - Instantly **Cancel** any active streaming loop (rAF) and breath timer.
    - **Snap** the input text to its final known state (Seed or Refined).
    - Log: `[Prefill] visibility hidden` + `snap action=tab_hidden`.
- **On Tab Return**:
    - **Do Nothing**. The input stays at the snapped state. We do NOT attempt to "resume" the animation mid-stream, as this often feels jarring or glitchy ("time travel" effect).

### 2. Layout (Resize) Policy: "Yield & Settle"
Resizing the window causes layout thrashing. Updating the textarea (via autosize) during a resize is performance suicide.
- **On Resize Start**:
    - **Cancel** streaming immediately.
    - **Snap** to final text.
    - Yield control to the browser's layout engine.
- **On Resize Settle (Debounced 150ms)**:
    - Run one single **Autosize** pass to ensure the textarea height is correct for the new width.
    - Log: `[Prefill] resize settle`.

## Manual Test Cases & Results

| Scenario | Action | Result |
| :--- | :--- | :--- |
| **Alt-Tab (Seed)** | Start handoff -> Alt-Tab away (3s) -> Return | Input shows full seed text immediately. No animation stutter. |
| **Alt-Tab (Refine)** | Wait for refine stream -> Alt-Tab away -> Return | Input shows full refined text. No "fast forward" visual glitch. |
| **Resize (Stream)** | Drag window corner while streaming | Streaming stops instantly. Text snaps to full. Window resize is smooth (60fps). |
| **Resize (Settling)** | Stop dragging window | 150ms later, log shows `resize settle`, input height adjusts perfectly. |
| **Panel Toggle** | Open/Close side panels | Handled same as resize (layout change triggers yield). |

## Logs Implemented
- `[Prefill] visibility hidden`
- `[Prefill] snap action=tab_hidden textLen=...`
- `[Prefill] resize start`
- `[Prefill] resize settle`
