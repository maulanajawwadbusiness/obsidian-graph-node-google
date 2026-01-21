# Presence Tab Integration Guide

This guide tells your code agent exactly what to copy and how to wire the presence tab into another React + TypeScript app without changing behavior.

## 1) Copy the files (exact sources)

From this project, copy these files into your target app:

- `src/components/PresenceStrip/PresenceStrip.tsx`
- `src/components/PresenceStrip/PresenceStrip.css`
- `public/document_viewer_icon.png`

If you want the panel + canvas shift demo behavior, also copy:

- `src/components/DocumentPanel/DocumentPanel.tsx`
- `src/components/DocumentPanel/DocumentPanel.css`
- `src/App.css` (only the `.graph-canvas` shift block)

## 2) Add design tokens (CSS variables)

Your target app must define the CSS variables used by the tab and panel. Add these to your global CSS (e.g. `src/index.css`), or ensure you already have equivalents:

```
--panel-width: 420px;
--transition-panel: 320ms cubic-bezier(0.32, 0.72, 0, 1);

--strip-highlight: hsl(42, 30%, 60%);
--strip-highlight-dim: hsl(42, 20%, 40%);
--strip-shadow-color: hsla(0, 0%, 0%, 0.5);
--strip-warning: hsl(35, 70%, 55%);
```

The tab styles also use these colors from the host theme:

```
--color-void
--color-surface
--color-surface-raised
--text-primary
--text-secondary
--text-muted
```

If your design system uses different names, map them by adding new variables or updating the selectors in `PresenceStrip.css`.

## 3) Add the component

Place `PresenceStrip.tsx` under your components folder, and import its CSS:

```tsx
import { PresenceStrip } from './components/PresenceStrip/PresenceStrip'
```

The component expects:

```ts
type ViewerMode = 'presence' | 'peek' | 'open'
type DocumentState = 'empty' | 'loaded' | 'warning'
```

If you already use your own document state enum, map it to these three string values or adjust the class names in the CSS.

## 4) Wire the state (required)

Add these state values to the closest owner that controls layout (usually your app shell):

```tsx
const [viewerMode, setViewerMode] = useState<ViewerMode>('presence')
const [documentState, setDocumentState] = useState<DocumentState>('loaded')
const [proximity, setProximity] = useState<'far' | 'near' | 'close'>('far')
const tabRef = useRef<HTMLButtonElement>(null)
```

Add the event handlers:

```tsx
const handleStripHover = useCallback((isHovering: boolean) => {
  if (viewerMode === 'open') return
  setViewerMode(isHovering ? 'peek' : 'presence')
}, [viewerMode])

const handleStripClick = useCallback(() => {
  setViewerMode(prev => (prev === 'open' ? 'presence' : 'open'))
}, [])
```

Keyboard behavior:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && viewerMode === 'open') {
      setViewerMode('presence')
      return
    }
    if (e.key === '\\' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setViewerMode(prev => (prev === 'open' ? 'presence' : 'open'))
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [viewerMode])
```

Proximity sensing (keep this logic as-is to preserve behavior):

```tsx
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => {
    if (viewerMode === 'open') {
      setProximity('far')
      return
    }

    const tab = tabRef.current
    if (!tab) return

    const rect = tab.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY)
    const nextProximity = distance <= 50 ? 'close' : distance <= 100 ? 'near' : 'far'
    setProximity(prev => (prev === nextProximity ? prev : nextProximity))
  }

  window.addEventListener('mousemove', handleMouseMove)
  return () => window.removeEventListener('mousemove', handleMouseMove)
}, [viewerMode])
```

## 5) Render the tab

Place the tab inside your root layout so it can be fixed-positioned against the viewport:

```tsx
<PresenceStrip
  viewerMode={viewerMode}
  documentState={documentState}
  proximity={proximity}
  onHover={handleStripHover}
  onClick={handleStripClick}
  tabRef={tabRef}
/>
```

## 6) (Optional) Wire the document panel

If you want the panel to open/close with the tab:

```tsx
<DocumentPanel
  isOpen={viewerMode === 'open'}
  documentState={documentState}
/>
```

Make sure your panel element uses the same `--panel-width` token.

## 7) (Optional) Shift your main canvas

If you want the content to shift right when the panel opens, add this to your app layout CSS:

```css
.app-container:has(.document-panel.is-open) .graph-canvas {
  margin-left: var(--panel-width);
}
```

## 8) Performance and behavior constraints (do not break)

- Keep animation on CSS transitions only; do not add per-frame JS.
- Use the shared `--transition-panel` curve to keep the tab and panel synchronized.
- Do not compute proximity unless the panel is closed (already guarded).
- Keep the tab fixed-position and outside the panel so it never reflows with content.
- Ensure the icon asset exists at `/document_viewer_icon.png`.

## 9) Checklist for your code agent

- [ ] Copy the PresenceStrip component + CSS
- [ ] Add the CSS variables or map them to your theme
- [ ] Wire `viewerMode`, `proximity`, and `tabRef` in your app shell
- [ ] Add hover/click/keyboard handlers
- [ ] Add the mousemove proximity handler
- [ ] Include the icon asset in `public/`
- [ ] Verify the tab stays visible and aligned with the panel edge when open
