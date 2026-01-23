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

## Doc Open Contract (Shell → First Content → Hydrate → Idle Measure)
Opening a document must feel instant and progressive.

Stages:
1. **Shell (instant)**: viewer panel opens immediately with header + lightweight placeholder.
2. **First content (fast)**: build only enough blocks for the first viewport and paint them quickly.
3. **Hydrate (progressive)**: build the rest in chunks with idle scheduling and batched commits.
4. **Post-idle measure**: remeasure heights only after user idle; preserve anchor.

Do-not-do list:
- Never build the entire document synchronously before first paint.
- Never run height measurement during active scroll or resize.
- Never run search/highlight work during first paint.

Font rule:
- Fonts are prewarmed at app boot; a single `font_ready` mark drives at most one idle remeasure.

Perf marks (gated by `__DOC_VIEWER_PERF_MARKS__` or `__DOC_VIEWER_PROFILE__`):
- `doc_open_start`, `file_read_done`, `text_extract_done`, `normalize_done`
- `block_build_first_chunk_done`, `first_paint_committed`, `hydrate_done`, `font_ready`

Jump stability report (Veils A–D):
- `docs/doc-open-jump-stability-a-d.md`

Key files:
- `src/document/viewer/DocumentContent.tsx`
- `src/document/viewer/docViewerPerf.ts`
- `src/document/workerClient.ts`

## Performance Contracts (Canon)
These are the non-negotiable performance rules for the viewer.

- **BUTTER SCROLL CONTRACT**: scroll must remain compositor-grade and continuous.
- **NO-BLANK invariant**: virtualization must never show gaps at the viewport edges.
- **PAINT-SAFE CONTRACT**: no filters/blur/large shadows on the scrolling layer.
- **MEASUREMENT CONTRACT**: no layout reads during scroll; measure only on idle.
- **RANGE CONTRACT**: rAF-throttled range updates, pixel overscan, stable block keys.
- **MAIN THREAD BUDGET CONTRACT**: background loops must throttle while viewer scrolls.

Performance edge cases report:
- `docs/performance-edgecases-v1.md`

## Virtualization and Smoothness
Virtualization is enabled for large documents to keep scrolling smooth.

Rules:
- rAF-throttled scroll handling.
- Pixel-based overscan.
- Overscan scales with viewport height to cover trackpad fling distance.
- Height measurement is cached and not done per-frame.
- Measurements only run on scroll idle, never during active scrolling.
- Cached block heights are reset on document changes to avoid stale ranges.
- Prefix height changes are anchored to preserve scroll position (no settle/jump).
- NO-BLANK invariant: scroll should never reveal empty gaps.
- BUTTER SCROLL CONTRACT: the scroll experience must be continuous and calm.

Key file:
- `src/document/viewer/useVirtualBlocks.ts`

## Paint / Compositor Safety (PAINT-SAFE CONTRACT)
Scrolling must remain GPU-friendly. The scrolling subtree must be “boring”.

Do NOT apply on the scrolling subtree:
- `filter`, `backdrop-filter`, or blur effects.
- Large `box-shadow` or `text-shadow` on the scrolling content.
- `transform` or `opacity` animations on scroll parents.
- `will-change: transform` on large containers.
- Large `border-radius` clipping on the scroll layer.

If visual depth is needed, apply it on static wrapper layers (non-scrolling siblings),
and validate with the flat-visuals A/B toggle (`window.__DOC_VIEWER_FLAT_VISUALS__`).

Key files:
- `src/document/viewer/viewerTokens.css`
- `src/document/viewer/DocumentViewerPanel.tsx`

## Long-Line / Evil-Doc Contract
The viewer must handle pathological text without horizontal scroll or layout stalls.

Rules:
- Use `overflow-wrap:anywhere` + `word-break:break-word` + `line-break:anywhere`.
- Very long runs are chunked into smaller spans to avoid giant text nodes.
- Paragraphs remain block-based; chunking must preserve offset mappings.
- Font fallback should be stable (avoid reflow storms during scroll).

Stress fixture:
- `public/dev-docs/document-viewer-stress.txt`

## Highlight / Search Contract
Highlights must never poison scroll performance.

Rules:
- All match computation happens on query submit/debounce, not on scroll.
- Highlight ranges are pre-sliced per block (sorted) and reused during scroll.
- No DOM reads or selection mapping runs during scroll ticks.
- Avoid per-frame allocations while scrolling.

Key files:
- `src/document/viewer/DocumentContent.tsx`
- `src/document/viewer/DocumentBlock.tsx`
- `src/document/viewer/SearchBar.tsx`
- `src/document/viewer/searchSession.ts`

## Toggle Contract (Mode/Theme)
Mode/theme toggles must preserve scroll anchor and avoid reflow storms.

Rules:
- Theme changes must not remount the viewer tree (CSS token swap only).
- A single, idle remeasure is scheduled after a toggle.
- The scroll anchor is preserved when prefix heights change.
- Toggle events must not trigger highlight/search recomputation loops.

Key files:
- `src/document/viewer/DocumentViewerPanel.tsx`
- `src/document/viewer/useVirtualBlocks.ts`

## Resize Contract (Resize/Zoom/Devtools)
Resizing must be stable: no blanking, no repeated measurement loops.

Rules:
- Resize updates range at rAF cadence only.
- Height remeasure is debounced and runs once after resize settles.
- Resize-induced layout shifts preserve the scroll anchor.
- Resize observers must be limited to the scroll container.

Key file:
- `src/document/viewer/useVirtualBlocks.ts`

## Main Thread Budget Contract (Background Tasks)
Background loops must yield to viewer scroll.

Rules:
- When the viewer is actively scrolling, background rAF loops throttle down.
- Avoid global store updates that touch the viewer during scroll.
- Keep overlays and background animations from overlapping the scroll subtree.

Key files:
- `src/playground/useGraphRendering.ts`
- `src/document/viewer/docViewerPerf.ts`

## Stress Test Suite (Manual)
Run these exact checks before declaring butter stable:
- Fling scroll hard up/down on a long doc (look for pop-in/gaps).
- Highlight stress: apply hundreds of highlights and fling scroll.
- Evil long-line doc: load `public/dev-docs/document-viewer-stress.txt`.
- Toggle mode/theme mid-scroll.
- Resize/zoom while scrolling (including devtools dock/undock).
- Run physics/animations with viewer open, then fling scroll.
- Doc open on a huge doc: time-to-first-text should be fast.

## Regression Traps (Do Not Reintroduce)
- Synchronous full-block builds before first paint.
- Layout reads inside scroll handlers.
- Overscan too small or based on block counts only.
- Heavy paint effects on scrolling subtree (blur/shadow/filter).
- Remounting the viewer tree on mode/theme toggles.
- Highlight/search work during first paint or scroll.

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
- Block keys are derived from stable text offsets (no index-based keys).
- Scroll-time handlers must avoid layout reads; viewport size is cached outside scroll.
- Height remeasurement only occurs at idle and must preserve anchor position.
- Overscan must scale with viewport height to prevent edge pop-in on fast scrolls.
- Scrolling subtree must respect the PAINT-SAFE CONTRACT (no filters/blur/shadow/transform).
- Long unbroken runs must be chunked to avoid giant text nodes.
- Highlight processing must be precomputed and not recomputed on scroll.
- Mode/theme toggles must schedule a single idle remeasure with anchor preservation.
- Resize must be debounced and never trigger measurement storms.
- Background rAF loops must throttle while viewer scrolls.

## Top 5 Regressions to Avoid (Butter Scroll)
1. **State updates on scroll** (anything beyond rAF-throttled range updates).
2. **Index-based block keys** that remount blocks during normalization.
3. **Layout reads inside scroll events** (`clientHeight`, `getBoundingClientRect`).
4. **Overscan too small for viewport height**, causing edge pop-in.
5. **Idle measurement without anchor compensation**, causing post-scroll “settle.”

## Regression Traps (Toggle/Resize/Budget)
- Triggering full remounts on mode/theme toggles.
- Resize observers that drive per-tick measurement loops.
- Background rAF loops that ignore `__DOC_VIEWER_SCROLLING__` and keep 60fps.

## Stress Test Doc Checklist
- 5000+ char unbroken line (URL/base64/code).
- Many long URLs and repeated tokens.
- Mixed CJK + Latin lines.
- Emoji + combining characters.
- One huge paragraph (dense prose).
- 50k+ line document (generate by duplicating the fixture).

## Stress Test Protocol
- Toggle mode/theme mid-scroll (flick trackpad while toggling).
- Resize/zoom or dock/undock devtools while scrolling.
- Run physics/animations with viewer open, then fling scroll.
- If available, stream AI output while scrolling.

## Quick Diagnosis Checklist (When Butter Breaks)
- Confirm `__DOC_VIEWER_PROFILE__` shows near-zero renders during scroll.
- Verify overscan tiering covers a fast trackpad flick (viewport-scaled).
- Ensure resize/viewport height is cached via ResizeObserver (no scroll-time reads).
- Inspect for empty ranges or gaps at viewport edges during a fling.
- Check that idle height measurement doesn’t shift scroll position.
- Toggle `__DOC_VIEWER_FLAT_VISUALS__` to isolate paint/compositor cost.

End of document.
