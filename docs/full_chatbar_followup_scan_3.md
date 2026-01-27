# Arnvoid Full Chatbar Deep Scan (Part 3)

This report addresses keybinding safety, global event listeners, and the intent of existing UI panels to prevent interaction bugs.

## 1) Keybinding Safety (Sidebar Toggle)

**Attachment Point:** 
Attached to `window` via `useEffect` in `GraphPhysicsPlayground.tsx`.

```tsx
// src/playground/GraphPhysicsPlayground.tsx (line 143)
window.addEventListener('keydown', onKeyDown);
```

**Typing Protection:**
The listener uses a guard function `isTypingTarget` which checks for `input`, `textarea`, `select`, and `isContentEditable`.

```tsx
// src/playground/GraphPhysicsPlayground.tsx (line 131)
return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
```

**Status: SAFE.** 
Typing "u" inside a message field will NOT accidentally toggle the sidebar.

---

## 2) Global Event Listeners

We searched for high-level listeners on `window` and `document` that might conflict with panel interaction.

### Found Global Listeners:

| File | Event | Purpose | Blocking Note |
| :--- | :--- | :--- | :--- |
| `NodePopup.tsx` | `keydown` (ESC) | Closes the popup. | Global (intentional). |
| `NodePopup.tsx` | `mousedown` | Click-outside to close. | Global (intentional). |
| `PdfViewer.tsx` | `keydown` (capture) | ArrowUp/Down navigation. | **Scoped** to viewer focus. |
| `useGraphRendering.ts` | `blur` | Clears hover state. | Global (Safe). |
| `MiniChatbar.tsx` | `resize` | Recalculates position. | Global (Safe). |

**Wheel Events:** 
No global `window.addEventListener('wheel')` listeners found. All wheel handling is done via local React event props (e.g., `onWheelCapture` in `HalfLeftWindow.tsx`), which means `stopPropagation()` on the Full Chatbar panel WILL successfully block canvas zooming.

---

## 3) SidebarControls Intent

**Factual Check:**
`SidebarControls.tsx` provides high-level physics debugging and graph generation tools:
- `onSpawn`: Clear and generate new graph.
- `onReset`: "Explode" existing nodes.
- `onLogPreset`: Dumps engine JSON to console.
- Sliders for: `springStiffness`, `repulsionStrength`, `damping`, etc.

**Conclusion:** 
Confirmed as a **Debug/Playground Only** utility. It is safe (and recommended) to auto-close this panel when the `FullChatbar` opens to avoid flexbox crowding.
