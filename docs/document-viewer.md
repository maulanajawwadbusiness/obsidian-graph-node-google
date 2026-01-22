# Document Viewer v1 - Concrete Reference

## Purpose
The document viewer is a persistent reading surface inside Arnvoid. It is not a modal and is never fully hidden. It provides a calm, native reading surface for parsed documents while staying synchronized with graph interactions.

## States and Layout
- Viewer has two states: `peek` and `open`.
- `peek`: panel width collapses to 0; the bookmark tab remains visible and interactive.
- `open`: panel width uses `--panel-width` and renders the full viewer UI.
- The viewer panel is a flex sibling to the graph canvas, so it pushes content rather than overlaying it.

Key files:
- `src/document/viewer/DocumentViewerPanel.tsx`
- `src/document/viewer/viewerTokens.css`

## Entry Points and Presence Tab
- The bookmark tab is always visible on the left edge.
- When the viewer is open, the tab sits at `left: var(--panel-width)`.
- When the viewer is closed (peek), the tab returns to `left: 0`.
- The tab and panel share the same `--panel-width` token to keep motion synchronized.

Key files:
- `src/PresenceStrip/PresenceStrip.tsx`
- `src/PresenceStrip/PresenceStrip.css`

## Width Model (Single Knob)
Width is controlled by a single scale knob in `:root`.

Tokens (defined in `src/index.css`):
- `--dv-panel-scale`: primary knob (e.g., 1.0, 0.9, 1.1).
- `--dv-panel-base-width`: base panel width in px.
- `--dv-panel-width`: computed panel width.
- `--panel-width`: shared width token used by panel and tab.
- `--dv-content-padding-x`: viewer inner horizontal padding.
- `--dv-sheet-padding`: sheet padding.
- `--dv-sheet-width`: computed sheet width.

Relationships:
- `--dv-panel-width = --dv-panel-base-width * --dv-panel-scale`
- `--panel-width = --dv-panel-width`
- `--dv-sheet-width = --dv-panel-width - ( --dv-content-padding-x + --dv-sheet-padding ) * 2`

Sheet width is always smaller than panel width to preserve breathing room.

## No Horizontal Scroll (Hard Invariant)
Horizontal scrolling is forbidden inside the viewer. It is enforced by layout rules:
- `.dv-content` uses `overflow-x: hidden` and `min-width: 0`.
- `.dv-document` and `.dv-document-body` use `min-width: 0` and `max-width: 100%`.
- Paragraphs use `white-space: normal`, `overflow-wrap: anywhere`, `word-break: break-word`.

Key file:
- `src/document/viewer/viewerTokens.css`

## Rendering Model
Document text is rendered as blocks, each corresponding to a line/paragraph boundary.

Block model:
- Each block has global character offsets `[start, end)`.
- Newlines are excluded from block text; offsets advance by `line.length + 1`.
- Each block renders a `<p>` with spans for highlight ranges.

Key files:
- `src/document/viewer/documentModel.ts`
- `src/document/viewer/DocumentBlock.tsx`
- `src/document/viewer/DocumentContent.tsx`

## Highlights and Selection Mapping
Highlights are stored as global character ranges and rendered via span classes.

- Active match: `.highlight-active`
- Other matches: `.highlight-other`

Selection and scroll mapping is offset-based:
- `findSpanContaining()` locates the span for a given character offset.
- `viewerApiRef.current.scrollToOffset(offset)` scrolls to a target range.

Key file:
- `src/document/viewer/selectionMapping.ts`

## Search
Search is event-driven and debounced.

- Ctrl+F opens search and ensures the viewer is open.
- Matches are computed as substring ranges.
- Active match is highlighted and scrolled into view.

Key files:
- `src/document/viewer/SearchBar.tsx`
- `src/document/viewer/searchSession.ts`

## Virtualization and Smoothness
Virtualization is enabled for large documents to keep scrolling smooth.

Rules:
- rAF-throttled scroll handling.
- Pixel-based overscan.
- Height measurement is cached and not done per-frame.
- NO-BLANK invariant: scroll should never reveal empty gaps.
- BUTTER SCROLL CONTRACT: the scroll experience must be continuous and calm.

Key file:
- `src/document/viewer/useVirtualBlocks.ts`

## Themes and Typography
The viewer supports an independent document theme (`light` or `dark`).

Dark mode:
- Base panel and sheet are in the blue-ink family (#13131D).
- Sheet is a small luma lift of the base.

Typography:
- UI labels use 12px base sizing.
- Body text defaults to 13px with a line height of 1.65.
- Paragraph spacing is controlled by `--dv-paragraph-gap`.

Key files:
- `src/document/viewer/docTheme.ts`
- `src/document/viewer/viewerTokens.css`
- `docs/color-tone-grammar.md`

## List Rhythm Heuristic
List grouping is handled by a simple heuristic:
- Lines starting with `1.` or `-` or `*` are treated as list items.
- Lines ending in `:` (and not list items) are treated as list intros.
- Spacing is tightened for list items and adjusted for list intros.

Key file:
- `src/document/viewer/DocumentBlock.tsx`

## Document Ingestion Flow
1. User drops a file on the canvas.
2. A worker parses the file off-thread.
3. Parsed text is stored in `DocumentStore`.
4. Viewer renders the document and clears old highlights.
5. The first words are bound to nodes (graph label binding).

Key files:
- `src/document/parsers.ts`
- `src/workers/documentWorker.ts`
- `src/store/documentStore.tsx`
- `src/document/nodeBinding.ts`

## Graph-to-Document Reveal
Nodes can reveal a specific text range in the viewer.

Flow:
1. Node reference is resolved to a doc range.
2. Viewer is opened if peeked.
3. Highlight range is set.
4. Viewer scrolls to the range and centers it.

Key files:
- `src/document/bridge/docGraphBridge.ts`
- `src/popup/adapters.ts`

## Color Tone Grammar (Summary)
- Base dark panel tone is #13131D.
- Green-leaning grays are forbidden.
- Viewer panel and node popup must share the same tone family.
- Shadows and borders stay in the same ink family.

Canonical reference:
- `docs/color-tone-grammar.md`

## Non-Negotiable Invariants
- No horizontal scroll in the viewer.
- Viewer and tab must share `--panel-width`.
- Sheet width must remain smaller than panel width.
- BUTTER SCROLL CONTRACT and NO-BLANK invariant must hold.
- Heavy shadows or blur must not be applied on the scrolling layer.

End of document.
