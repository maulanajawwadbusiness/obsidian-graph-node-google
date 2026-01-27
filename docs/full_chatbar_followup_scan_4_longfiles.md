# Arnvoid Full Chatbar Deep Scan (Part 4)

This report performs a final long-file audit and confirms critical interaction seams to ensure zero surprises during implementation.

## 1) Long File Audit

**Hard Requirement Check:** No files in `src/` exceed 1000 lines. The largest file is `theme.ts` at 451 lines.

| Path | Lines | What it does |
| :--- | :--- | :--- |
| `src/visual/theme.ts` | 451 | Central visual configuration and skin (normal/elegant) definitions. |
| `src/popup/MiniChatbar.tsx` | 409 | Floating chat window with autoscroll and basic input. |
| `src/playground/GraphPhysicsPlayground.tsx` | 404 | Main entry point and top-level layout coordinator. |
| `src/ArnvoidDocumentViewer/engines/PdfEngine/PdfViewer.tsx` | 396 | Core PDF rendering and toolbar logic. |
| `src/physics/engine.ts` | 309 | Central physics simulation loop and entity management. |
| `src/playground/useGraphRendering.ts` | 284 | React hook bridging the physics engine and 2D canvas rendering. |
| `src/popup/NodePopup.tsx` | 252 | Detailed node info display with staged reveal animations. |
| `src/playground/graphRandom.ts` | 206 | Deterministic random graph generation logic. |
| `src/physics/engine/integration.ts` | 203 | Physics integration pass (Verlet/Euler). |
| `src/physics/engine/forcePass.ts` | 190 | Logic for applying repulsion, gravity, and springs per tick. |
| `src/playground/rendering/renderingTypes.ts` | 184 | Type definitions for camera, hover, and render states. |
| `src/playground/rendering/canvasUtils.ts` | 180 | Low-level 2D canvas drawing helpers (vignette, etc.). |
| `src/physics/engine/velocity/angleResistance.ts`| 164 | Physics pass for angular momentum and spin resistance. |
| `src/store/documentStore.tsx` | 140 | Global state for document parsing and preview status. |
| `src/popup/ChatInput.tsx` | 152 | Multiline textarea-based input component. |

**modularization status:** PASSED. No file is near the 1000-line modularization threshold.

---

## 2) Right Dock Panel Seam Confirmation

**Current Layout Tree:**
```tsx
// src/playground/GraphPhysicsPlayground.tsx (approx line 334)
return (
    <div style={CONTAINER_STYLE}> {/* flex row */}
        <HalfLeftWindow ... /> {/* flex: 0 0 50%, unmounts if closed */}
        <div style={MAIN_STYLE}> {/* flex: 1, canvas wrapper */}
            <canvas ... />
            <CanvasOverlays ... />
            <TextPreviewButton ... />
            <AIActivityGlyph />
            <PopupPortal />
        </div>
        {sidebarOpen && <SidebarControls />} {/* flex sibling, right-aligns */}
    </div>
);
```
**Conclusion:** The seam is perfectly clean. A new `FullChatbar` should be inserted as a flex sibling between `MAIN_STYLE` and `SidebarControls`.

---

## 3) Interaction Ownership & Leak Check

**Global Listeners Audit:**
- `window.addEventListener('keydown')`: Guarded by `isTypingTarget` in Playground. Safe.
- `window.addEventListener('blur')`: Correctly clears hover states. Safe.
- `window.addEventListener('resize')`: Used for repositioning. Safe.
- **Wheel Detection**: NO global `wheel` listeners found on `window` or `document`.
- **Conclusion**: The standard `onPointer...Capture` and `onWheelCapture` pattern with `stopPropagation()` will satisfy full interaction ownership for the chat panel.

---

## 4) "Current Focus" Ground Truth

- **Selected Node ID**: Stored in `PopupStore.tsx` as `selectedNodeId`. Set in `openPopup` and `switchToNode`. Cleared in `closePopup`.
- **Last Clicked Node**: **NOT tracked separately today.** Currently, "focus" and "last click" are synonymous.
- **Landmine**: If the chatbar implementation requires context from a node *after* the popup is closed, we must add a `lastClickedNodeId` persistency layer in the store.

---

## 5) Chat UX Reuse Seams

- **Input Behavior**:
  - `ChatInput.tsx` (Line 106) is the "Gold Standard" (Shift+Enter for newline, Enter to send).
  - `MiniChatbar.tsx` uses a simpler `<input>` (Line 373).
  - *Recommendation*: Reuse `ChatInput` logic for Full Chatbar.
- **Autoscroll**:
  - `MiniChatbar.tsx` (Line 232): `scrollIntoView({ behavior: 'smooth' })` on a hidden bottom div is the established pattern.
- **Data Model**:
  - `MiniChatbar.tsx` (Line 12): `Message` type is `{ role: 'user' | 'ai', text: string }`.
  - *Note*: `PopupStore.tsx` (Line 52) uses the same structure.
