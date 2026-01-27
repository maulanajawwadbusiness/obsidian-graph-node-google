# Arnvoid Full Chatbar Deep Scan Report

This report dissects the current UI layout, interaction patterns, and data models of the Arnvoid environment to prepare for the implementation of the "Full Chatbar" (Right Dock Panel).

## A) Current UI Layout + Docking Seams

### 1) Top-Level Layout Tree (JSX)
The top-level layout is defined in `src/playground/GraphPhysicsPlayground.tsx` within the `GraphPhysicsPlaygroundInternal` component.

```tsx
// src/playground/GraphPhysicsPlayground.tsx (approx line 334)
return (
    <div style={{ ...CONTAINER_STYLE, background: activeTheme.background }}>
        <HalfLeftWindow
            open={documentContext.state.previewOpen}
            onClose={() => { ... }}
            rawFile={lastDroppedFile}
        />
        <div
            style={MAIN_STYLE}
            onMouseDown={handleMouseDown}
            // ... (pointer handlers)
        >
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', ... }} />
            <CanvasOverlays ... />
            <TextPreviewButton onToggle={toggleViewer} />
            <AIActivityGlyph />
            <PopupPortal />
        </div>

        {sidebarOpen && (
            <SidebarControls ... />
        )}
    </div>
);
```

### 2) Identifying Right Dock Mount Point
The `CONTAINER_STYLE` uses `display: flex`.
```ts
// src/playground/graphPlaygroundStyles.ts
export const CONTAINER_STYLE: React.CSSProperties = {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    // ...
};

export const MAIN_STYLE: React.CSSProperties = {
    flex: 1,
    position: 'relative',
    cursor: 'grab',
};
```
**Integration Point:** A new `FullChatbar` component should be mounted as a **sibling** to `MAIN_STYLE`, placed after it in the JSX to appear on the right. With `flex: 0 0 30%` or similar, it will push the `MAIN_STYLE` (canvas container) and cause the canvas to auto-resize.

### 3) Canvas Resizing Handling
Resizing is handled automatically in the render loop via `getBoundingClientRect`.

```ts
// src/playground/useGraphRendering.ts (approx line 119)
const rect = canvas.getBoundingClientRect();
const dpr = window.devicePixelRatio || 1;
const displayWidth = Math.max(1, Math.round(rect.width * dpr));
const displayHeight = Math.max(1, Math.round(rect.height * dpr));

if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    engine.updateBounds(rect.width, rect.height); // Resets physics grid/bounds
}
```

---

## B) Pointer Ownership Pattern

### 1) Blocking Canvas Interaction
Current panels (like the left dock) block interaction by capturing pointer events and stopping propagation.

```tsx
// src/playground/components/HalfLeftWindow.tsx (approx line 108)
const stop = (e: unknown) => {
    const evt = e as { stopPropagation?: () => void };
    evt.stopPropagation?.();
};

return (
    <div
        style={{ ...PANEL_STYLE, touchAction: 'pan-x pan-y' }}
        onPointerDownCapture={stop}
        onPointerMoveCapture={stop}
        onPointerUpCapture={stop}
        onPointerCancelCapture={stop}
        onWheelCapture={stopWheel}
        // ...
    >
```
**Conclusion:** The full chatbar MUST use `onPointer...Capture` handlers with `stopPropagation()` to prevent the canvas (which has handlers on `MAIN_STYLE`) from reacting to clicks/drags.

### 2) Pointer Ownership
- **Canvas Container (`MAIN_STYLE`)**: Owns bubble-phase pointer events for graph interaction (drag/hover).
- **Window Level**: No global window listeners for pointer/wheel were found that would override panel blocking, except for a `blur` listener in `useGraphRendering.ts`.

---

## C) Popup + Focus Signals

### 1) selectedNodeId / open popup State
State is managed in `PopupStore.tsx`.

```ts
// src/popup/PopupStore.tsx
const initialState: PopupState = {
    isOpen: false,
    selectedNodeId: null,
    anchorGeometry: null,
    // ...
};
```
- `selectedNodeId`: The UUID of the node currently showing a popup.
- `isOpen`: Boolean toggling the `NodePopup` visibility.
- `anchorGeometry`: `{ x, y, radius }` in screen space for positioning.

### 2) Open/Close Mechanism
- **Open**: `onPointerDown` on a node calls `popupContext.openPopup(nodeId, geometry)`.
- **Close**: Clicking outside or ESC calls `popupContext.closePopup()`, which reverts to `initialState`.

### 3) Uniqueness
Only **one** popup can be open at a time. The `openPopup` function resets the entire state (line 25 in `PopupStore.tsx`), and `selectedNodeId` is a single value.

---

## D) Popup Summary Content

### 1) Current Source of Summary
The summary text is currently **hardcoded** in `NodePopup.tsx`.

```tsx
// src/popup/NodePopup.tsx (approx line 234)
<div style={{ ...CONTENT_STYLE, ...contentTransition }}>
    <div style={LABEL_STYLE}>{nodeLabel}</div>
    <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
        incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
        exercitation ullamco laboris.
    </p>
</div>
```

### 2) Available Fields on Node Model
The node model (`PhysicsNode` in `src/physics/types.ts`) contains:
- `id`: string
- `label`: string (This is currently the AI-generated/parsed label)
- `role`: 'spine' | 'rib' | 'fiber' (optional)

**Summary Fact:** There is currently NO "summary content" field on the node or document model. The Full Chatbar implementation will need to define where this content is fetched from (likely an extension of `DocumentStore` or `PopupStore`).

---

## E) Mini Chatbar Data Model

### 1) Mini Chatbar State
State is stored in `PopupStore` and reset when the popup closes.
- **Keyed by**: The active popup (if `isOpen` is true).

### 2) Message Structure
```ts
// src/popup/popupTypes.ts (and implicitly in MiniChatbar.tsx)
messages: Array<{
    role: 'user' | 'ai';
    text: string;
}>
```

### 3) Mock Reply Generation
Mock replies are hardcoded in `PopupStore.tsx`.

```ts
// src/popup/PopupStore.tsx (line 53)
const aiMessage = {
    role: 'ai' as const,
    text: 'This is a mock AI response. In the future, this will be a real AI-powered reply...',
};
```

### 4) "Send to Full Chat" Button Placement
Requested placement in `MiniChatbar.tsx` between the input and send button.

```tsx
// src/popup/MiniChatbar.tsx (approx line 372)
<div style={INPUT_STYLE}>
    <input
        type="text"
        // ... (input props)
    />
    {/* SEAM: Insert "Send to Full Chat" button here */}
    <button onClick={handleSend} ...>
        <img src={sendIcon} ... />
    </button>
</div>
```

---

## F) Full Chatbar V1 Seams

### 1) Toggle Button Pattern
Reuse the `TextPreviewButton` pattern but positioned at the bottom-right.
- **Location**: `src/playground/components/FullChatToggle.tsx` (suggested).
- **Style**: Fixed position, `bottom: 20px`, `right: 20px`.

### 2) Lifecycle
The chatbar should follow the `HalfLeftWindow` pattern: **unmount when closed** (`if (!open) return null;`) to save performance and simplify state management.

### 3) Mock AI Replies
The Full Chatbar should reuse the `sendMessage` pattern from `PopupStore` but likely in its own `ChatStore` or an expanded `PopupStore` to handle "Full Chat" sessions separately from "Node" sessions.

---

## G) Z-Index + Overlays

### 1) Current Z-Index Ladder
- **Z=100**: `TextPreviewButton` (Bottom-left toggle)
- **Z=400**: `HalfLeftWindow` (Left dock)
- **Z=1000**: `PopupOverlayContainer` (Portal Root)
- **Z=1001**: `NodePopup` (Portal Child)
- **Z=1002**: `MiniChatbar` (Portal Child)
- **Z=999999**: `CanvasOverlays` (Debug Metrics)

**Integraton Fact:** The Full Chatbar (Right Dock) should likely live between Z=400 and Z=1000 to be behind popups but above the canvas UI if overlapping (though it will be a flex sibling).

---

## H) Performance + Debuggability

### 1) Perf Logging Patterns
- `useGraphRendering.ts` tracks `fps`, `avgVel`, etc., via `createMetricsTracker`.
- `PlaygroundMetrics` state is updated every frame.

### 2) Recommended Log Hooks
- **Toggle**: `console.log('[FullChat] Toggled:', isOpen)`
- **Focus Change**: `console.log('[FullChat] Context updated for node:', nodeId)` in `switchToNode`.
- **Handoff**: `console.log('[FullChat] Data transferred from mini-chat:', messages)`

---

## I) Quick Repro Checklist

- [ ] **Toggle Integrity**: Clicking the bottom-right button opens/closes a 30% width panel on the right.
- [ ] **Canvas Auto-Resize**: Canvas `width` and `height` properties actually change when the panel opens.
- [ ] **Interaction Block**: Clicking inside the full chatbar does NOT select or drag nodes on the canvas underneath.
- [ ] **Focus Persistence**: Opening the full chatbar correctly captures the `selectedNodeId` if a popup is/was open.
- [ ] **Autoscroll**: Sending a message in full chat (or receiving a mock reply) automatically scrolls the message container to the bottom.
