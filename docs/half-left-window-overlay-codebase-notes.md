# Half-left window overlay (50vw) — codebase notes (for placeholder panel only)

This file answers the 8 requested items with **direct code snippets** or precise notes from the current repo. No viewer integration yet—just an empty left panel + bottom-left toggle, and the canvas should become the right-side region by layout.

---

## 1) `GraphPhysicsPlayground.tsx` layout

### JSX tree (top-level)

From `src/playground/GraphPhysicsPlayground.tsx`:

```tsx
return (
  <div style={{ ...CONTAINER_STYLE, background: activeTheme.background }}>
    <div
      style={MAIN_STYLE}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onPointerUp={onPointerUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', background: activeTheme.background }} />

      <CanvasOverlays ... />
      <TextPreviewButton />
      <TextPreviewPanel />
      <AIActivityGlyph />
      <PopupPortal />
    </div>

    {sidebarOpen && <SidebarControls ... />}
  </div>
);
```

### `MAIN_STYLE` and sizing model

From `src/playground/graphPlaygroundStyles.ts`:

```ts
export const CONTAINER_STYLE: React.CSSProperties = {
  display: 'flex',
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  fontFamily: "'Quicksand', Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
  background: '#111',
  color: '#eee',
};

export const MAIN_STYLE: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  cursor: 'grab',
};
```

**Implication:** the app already uses a flex row shell; `MAIN_STYLE` takes remaining width. Adding a left sibling panel inside `CONTAINER_STYLE` will naturally shrink the canvas region to the right.

---

## 2) Where camera / rendering bounds come from

### Where `useGraphRendering()` gets viewport width/height

From `src/playground/useGraphRendering.ts` render loop:

```ts
const rect = canvas.getBoundingClientRect();
const dpr = window.devicePixelRatio || 1;
const displayWidth = Math.max(1, Math.round(rect.width * dpr));
const displayHeight = Math.max(1, Math.round(rect.height * dpr));

if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
  canvas.width = displayWidth;
  canvas.height = displayHeight;
  engine.updateBounds(rect.width, rect.height);
}

const width = rect.width;
const height = rect.height;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

So “viewport” for rendering is effectively **`canvas.getBoundingClientRect()`** (CSS pixels), evaluated **every frame**.

### Resize observer / window resize listener?

- There is **no** `ResizeObserver` or `window.addEventListener('resize', ...)` used for canvas sizing.
- The sizing is **pull-based each frame** via `getBoundingClientRect()` and the `canvas.width/height` sync shown above.

### Any `canvasWidth/canvasHeight` or `viewportW/H` variable we can offset?

- There’s no dedicated `viewportW/H` variable in component state.
- In practice, the “offset” lever is: **change the canvas element’s CSS box** (via layout), because all sizing comes from `getBoundingClientRect()`.

### Code that sets transforms (world→screen + camera)

Camera transform application (from `src/playground/rendering/camera.ts`):

```ts
export const applyCameraTransform = (ctx, camera, width, height, centroid, angle) => {
  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(camera.panX, camera.panY);

  ctx.translate(centroid.x, centroid.y);
  ctx.rotate(angle);
  ctx.translate(-centroid.x, -centroid.y);
};
```

The explicit world→screen helper used by hover/popup anchoring (from `src/playground/rendering/hoverController.ts`):

```ts
const worldToScreen = (worldX, worldY, rect) => {
  const camera = cameraRef.current;
  const engine = engineRef.current;
  const centroid = engine ? engine.getCentroid() : { x: 0, y: 0 };
  const angle = engine ? engine.getGlobalAngle() : 0;

  const rotated = rotateAround(worldX, worldY, centroid.x, centroid.y, angle);
  const viewX = (rotated.x + camera.panX) * camera.zoom;
  const viewY = (rotated.y + camera.panY) * camera.zoom;
  return {
    x: viewX + rect.width / 2,
    y: viewY + rect.height / 2
  };
};
```

---

## 3) Existing left UI

### Are `TextPreviewButton` and `TextPreviewPanel` still used?

**Yes.** They are mounted directly inside the `MAIN_STYLE` wrapper (see section 1 JSX tree).

### Their z-index / inline styles

From `src/playground/components/TextPreviewButton.tsx`:

```ts
const TEXT_BUTTON_STYLE: React.CSSProperties = {
  position: 'absolute',
  bottom: '20px',
  left: '20px',
  // ...
  zIndex: 100,
};
```

From `src/playground/components/TextPreviewPanel.tsx`:

```ts
const PANEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '400px',
  height: '100%',
  // ...
  zIndex: 200,
};
```

### `previewOpen` boolean and toggle behavior (DocumentStore)

From `src/store/documentStore.tsx`:

```ts
const initialState: DocumentState = {
  activeDocument: null,
  status: 'idle',
  errorMessage: null,
  previewOpen: false,
  aiActivity: false,
};

case 'TOGGLE_PREVIEW':
  return { ...state, previewOpen: !state.previewOpen };

// Hook API:
togglePreview: () => dispatch({ type: 'TOGGLE_PREVIEW' }),
setPreviewOpen: (open) => dispatch({ type: 'SET_PREVIEW', open }),
```

And the button uses `togglePreview()`:

```tsx
onClick={(e) => {
  stopPropagation(e);
  togglePreview();
}}
```

---

## 4) Pointer events / event handlers

### Which element owns graph pointer handlers?

The **canvas wrapper `<div style={MAIN_STYLE}>`** owns the handlers (from `src/playground/GraphPhysicsPlayground.tsx`):

```tsx
<div
  style={MAIN_STYLE}
  onPointerDown={onPointerDown}
  onPointerEnter={onPointerEnter}
  onPointerMove={onPointerMove}
  onPointerLeave={onPointerLeave}
  onPointerCancel={onPointerCancel}
  onPointerUp={onPointerUp}
  // ...
>
  <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
  {/* overlays */}
</div>
```

### Any `onWheel` handlers?

No. Repo-wide search shows **no `onWheel`** and no `addEventListener('wheel', ...)` anywhere under `src/`.

### Do overlays call `stopPropagation`? mouse events or pointer events?

Existing overlay pattern is **mouse-only** stopPropagation:
- `TextPreviewPanel`:

```tsx
onMouseDown={stopPropagation}
onMouseMove={stopPropagation}
onMouseUp={stopPropagation}
```

- `TextPreviewButton`:

```tsx
onMouseDown={stopPropagation}
onMouseMove={stopPropagation}
onMouseUp={stopPropagation}
```

Popups/chat do the same: they stop mouse events (not pointer events) and set `pointerEvents: 'auto'` in their styles.

### Existing overlay pattern that prevents canvas interaction under it?

**Yes:** `TextPreviewPanel` is an absolute overlay inside `MAIN_STYLE` and uses mouse stopPropagation. It prevents mouse-driven drag behavior from hitting the wrapper, but it does not explicitly stop pointer events.

---

## 5) Z-index / portal layering

### Canvas overlays (inside `MAIN_STYLE`)
- `CanvasOverlays` buttons:
  - `SIDEBAR_TOGGLE_STYLE.zIndex = 10`
  - `DEBUG_TOGGLE_STYLE.zIndex = 11`
  - `THEME_TOGGLE_STYLE.zIndex = 11`
  - (from `src/playground/graphPlaygroundStyles.ts`)

### Text preview UI
- `TextPreviewButton`: `zIndex: 100` (from `src/playground/components/TextPreviewButton.tsx`)
- `TextPreviewPanel`: `zIndex: 200` (from `src/playground/components/TextPreviewPanel.tsx`)

### Popup portal layering (on `document.body`)
- `PopupOverlayContainer`: `zIndex: 1000`, `pointerEvents: 'none'` (from `src/popup/PopupOverlayContainer.tsx`)
- `NodePopup`: `zIndex: 1001`, `pointerEvents: 'auto'` (from `src/popup/NodePopup.tsx`)
- `MiniChatbar`: `zIndex: 1002`, `pointerEvents: 'auto'` (from `src/popup/MiniChatbar.tsx`)

### Debug overlay
- `DEBUG_OVERLAY_STYLE.zIndex = 999999` (from `src/playground/graphPlaygroundStyles.ts`)

---

## 6) “readjust map to right” mechanism

### Is the canvas full-screen always?

The `<canvas>` is styled with `width: '100%', height: '100%'` and sits in `MAIN_STYLE` which is `flex: 1`.
So its size is **whatever width/height the layout gives the `MAIN_STYLE` wrapper**.

### Do we have a “sidebar width” concept already?

Yes: the right-side controls panel uses a fixed width:

```ts
export const SIDEBAR_STYLE: React.CSSProperties = {
  width: '320px',
  // ...
};
```

And is conditionally rendered as a sibling of the main canvas wrapper (see section 1 JSX tree).

### Is camera centered automatically each frame or only on init?

It is effectively auto-fit/centered **every frame**:

From `src/playground/useGraphRendering.ts`:

```ts
const nodes = Array.from(engine.nodes.values());
updateCameraContainment(cameraRef, nodes, width, height);
```

And `updateCameraContainment` (from `src/playground/rendering/camera.ts`) sets `targetPan/targetZoom` and damps toward them every call:

```ts
camera.targetPanX = -aabbCenterX;
camera.targetPanY = -aabbCenterY;
camera.targetZoom = requiredZoom;

const dampingFactor = 0.15;
camera.panX += (camera.targetPanX - camera.panX) * dampingFactor;
camera.panY += (camera.targetPanY - camera.panY) * dampingFactor;
camera.zoom += (camera.targetZoom - camera.zoom) * dampingFactor;
```

### Any function that recenters / clamps camera / fits content?

Yes: `updateCameraContainment()` is the fit/contain logic (snippet above). There’s no separate “fit once” mode—this runs continuously.

**Implication for “readjust to right”:** if you shrink the canvas region (e.g., by adding a 50vw left sibling panel in the flex container), the camera fit logic will recompute against the new `width/height` and re-center content in that right-hand region automatically.

---

## 7) Routing / app shell

### Where is `GraphPhysicsPlayground` rendered?

Directly from `src/main.tsx` (no `App.tsx`):

```tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GraphPhysicsPlayground />
  </React.StrictMode>,
)
```

`index.html` is minimal:

```html
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

### Global CSS that affects body/html height/overflow?

From `src/index.css`:

```css
body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}
```

Note: `CONTAINER_STYLE` sets `width: 100vw; height: 100vh; overflow: hidden;` so the app itself enforces full-viewport sizing regardless of body centering.

---

## 8) Styling approach

### What styling system is used?

- Predominantly **inline `React.CSSProperties` objects** in TS/TSX.
- A single global stylesheet `src/index.css` for font-face, root variables, scrollbar styling, and some utility classes.

### Where is the main background/blur effect applied?

- Main background is passed from theme into container + canvas:
  - `GraphPhysicsPlayground.tsx`: `style={{ ...CONTAINER_STYLE, background: activeTheme.background }}`
  - Canvas also uses `background: activeTheme.background`
- Blur is applied in overlay components via `backdropFilter`, e.g.:
  - `TextPreviewPanel`: `backdropFilter: 'blur(12px)'`
  - `MiniChatbar`: `backdropFilter: 'blur(12px)'`
  - `NodePopup`: `backdropFilter` changes on animation state (starts `blur(0px)` → visible `blur(12px)`)

