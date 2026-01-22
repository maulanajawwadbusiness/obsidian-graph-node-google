# System Architecture - Arnvoid Graph + Document Viewer

## Overview
Arnvoid is a graph physics playground with a first-class document viewer. The viewer is a persistent reading surface (not a modal) that supports parsing, search, highlights, and graph-to-document reveal. A bookmark presence tab is always visible and stays glued to the panel edge during open/close motion.

## Big Picture (in words)
- Graph physics renders nodes and handles interaction.
- Documents are parsed off the main thread and stored in the document store.
- The document viewer renders parsed text as blocks, supports search and highlights, and exposes a scroll API for reveal.
- The graph-to-document bridge attaches references to nodes and can reveal those ranges in the viewer.
- The bookmark presence tab is a fixed UI handle that tracks the viewer panel width.

## Core Modules and Responsibilities

### Document Pipeline
- `src/document/parsers.ts` and `src/workers/documentWorker.ts` parse files (txt, md, docx, pdf) off-thread.
- `src/store/documentStore.tsx` owns document state, viewer mode, and highlights.
- `src/document/types.ts` defines `ParsedDocument` and status types.

### Document Viewer
- `src/document/viewer/DocumentViewerPanel.tsx` is the main panel (peek/open states, header, search, content).
- `src/document/viewer/DocumentContent.tsx` renders blocks with virtualization support.
- `src/document/viewer/DocumentBlock.tsx` renders each paragraph and applies list heuristics.
- `src/document/viewer/viewerTokens.css` is the primary styling and layout contract.
- `src/document/viewer/docTheme.ts` defines theme tokens and maps them to CSS variables.

### Graph-to-Document Bridge
- `src/document/bridge/nodeDocRef.ts` and `src/document/bridge/docGraphBridge.ts` define and manage node references.
- `src/popup/adapters.ts` exposes a real viewer adapter for reveal and highlights.

### Bookmark Presence Tab
- `src/PresenceStrip/PresenceStrip.tsx` renders the bookmark tab.
- `src/PresenceStrip/PresenceStrip.css` positions the tab relative to the panel width.
- `src/playground/GraphPhysicsPlayground.tsx` wires viewerMode to tab state.

## Viewer States and Layout
- `viewerMode: 'peek' | 'open'`. No fully closed state.
- Panel width when open uses `--panel-width`.
- Peek state collapses the panel width to 0, leaving only the tab/handle visible.

## Width + Layout Model (Single Knob)
Width is driven by a single scale knob in `:root`.

Tokens (in `src/index.css`):
- `--dv-panel-scale`: primary knob for width (e.g., 1.0, 0.9, 1.1).
- `--dv-panel-base-width`: base width in px.
- `--dv-panel-width`: computed panel width.
- `--panel-width`: shared width token for panel and tab.
- `--dv-content-padding-x`: viewer horizontal padding.
- `--dv-sheet-padding`: sheet padding.
- `--dv-sheet-width`: computed from panel width minus padding.

Relationships:
- `--dv-panel-width = --dv-panel-base-width * --dv-panel-scale`
- `--panel-width = --dv-panel-width`
- `--dv-sheet-width = --dv-panel-width - ( --dv-content-padding-x + --dv-sheet-padding ) * 2`
- `docTheme.maxLineWidth = var(--dv-sheet-width, 68ch)` to keep sheet width aligned.

## No Horizontal Scroll (Hard Invariant)
Horizontal scrolling is forbidden in the viewer.

Enforcement:
- `.dv-content { overflow-x: hidden; min-width: 0; }`
- `.dv-document, .dv-document-body { min-width: 0; max-width: 100%; box-sizing: border-box; }`
- `.dv-document-body p { white-space: normal; overflow-wrap: anywhere; word-break: break-word; }`

## Bookmark Tab Integration
- Closed: `.presence-strip-container` sits at `left: 0`.
- Open: `.presence-strip-container.mode-open` moves to `left: var(--panel-width)`.
- The tab uses the same `--panel-width` token as the viewer, keeping motion in sync.
- `z-index` for the tab container is higher than the panel, so it is never buried.

## Event Flows

### File Drop -> View
- User drops a file on the canvas.
- Parser runs in `documentWorker`, result stored in `documentStore`.
- Viewer renders the document and highlights are cleared.
- First words bind to node labels via `nodeBinding`.

### Node Reveal -> Viewer
- User triggers reveal from a node popup.
- Bridge validates the doc ref, opens the viewer if needed.
- Highlights are set and `viewerApiRef.scrollToOffset()` is called.

### Search
- Search opens with Ctrl+F (also opens the viewer if peeked).
- Matches are computed and highlighted, active match is scrolled into view.

## Performance Rules
- Viewer is event-driven, no per-frame coupling to physics loop.
- Parsing is always off-main-thread.
- Scroll handlers are throttled; virtualization is used for large docs.

## Key Invariants (Do Not Break)
- No horizontal scrollbar inside the document viewer.
- Panel width and tab position must share `--panel-width`.
- Bookmark tab must always be visible and above the panel.
- Sheet must remain narrower than the panel (breathing room).
- Viewer open/peek transitions must stay smooth and synchronized.

## Key Files
- `src/index.css` - Global width tokens, single knob setup.
- `src/document/viewer/viewerTokens.css` - Viewer layout, wrapping rules, sheet styling.
- `src/document/viewer/docTheme.ts` - Theme tokens, max line width wiring.
- `src/document/viewer/DocumentViewerPanel.tsx` - Panel layout, data attributes, state handling.
- `src/document/viewer/DocumentBlock.tsx` - List heuristics and paragraph classes.
- `src/PresenceStrip/PresenceStrip.css` - Tab positioning and z-index.

End of document.
