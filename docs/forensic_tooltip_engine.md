# Forensic Report: Custom Tooltip Engine (Run 1)

Date: 2026-02-15
Scope: Scan and dissect existing tooltip behavior and tooltip-like patterns. No implementation in this run.

## 0) Context read before scan
- Read `docs/system.md`.
- Read `docs/repo_xray.md`.

Key constraints confirmed from docs:
- Canvas is substrate; overlays and panels must own pointer and wheel input.
- AppShell layering is: graph/content base -> sidebar overlay -> modal layer.
- Graph screen layout is owned by `GraphScreenShell`; do not add competing z-index there.
- Existing overlay contract already relies on pointer and wheel shielding with `stopPropagation`.

## 1) Tooltip inventory (current state)

Legend:
- `title`: native browser tooltip path today.
- `aria-label`: accessibility label, not guaranteed visible tooltip by default.
- `paired`: both `title` and `aria-label` on same control.

### 1.1 `title` usage (native tooltip surface)

1. `src/components/SendButton.tsx:53`
- Pattern: `title`
- Attached to: send icon button in prompt/chat send control.

2. `src/components/PromptCard.tsx:118`
- Pattern: `title`
- Attached to: remove uploaded file button.

3. `src/components/PromptCard.tsx:144`
- Pattern: `title`
- Attached to: upload document button.

4. `src/fullchat/FullChatbar.tsx:741`
- Pattern: `title` (paired with aria)
- Attached to: full chat close button.

5. `src/popup/MiniChatbar.tsx:420`
- Pattern: `title`
- Attached to: mini chat close button.

6. `src/popup/MiniChatbar.tsx:467`
- Pattern: `title`
- Attached to: mini chat extend-to-main button.

7. `src/popup/NodePopup.tsx:420`
- Pattern: `title`
- Attached to: node popup close button.

8. `src/playground/components/TextPreviewButton.tsx:64`
- Pattern: `title` (paired with aria)
- Attached to: document viewer toggle icon on graph.

9. `src/playground/components/HalfLeftWindow.tsx:126`
- Pattern: `title` (paired with aria)
- Attached to: document viewer panel close button.

10. `src/playground/components/AIActivityGlyph.tsx:66`
- Pattern: `title`
- Attached to: AI activity glyph.

11. `src/playground/components/SidebarControls.tsx:45`
- Pattern: `title` (paired with aria)
- Attached to: debug sidebar close control.

12. `src/playground/components/CanvasOverlays.tsx:281`
- Pattern: `title` (paired)
- Attached to: show debug button.

13. `src/playground/components/CanvasOverlays.tsx:298`
- Pattern: `title` (paired)
- Attached to: theme toggle button.

14. `src/playground/components/CanvasOverlays.tsx:315`
- Pattern: `title` (paired)
- Attached to: controls sidebar toggle.

15. `src/playground/components/CanvasOverlays.tsx:345`
- Pattern: `title` (paired)
- Attached to: dev download JSON button.

16. `src/playground/components/CanvasOverlays.tsx:393`
- Pattern: `title` (paired)
- Attached to: top-right share icon.

17. `src/playground/components/CanvasOverlays.tsx:433`
- Pattern: `title` (paired)
- Attached to: top-right dots menu trigger.

18. `src/playground/components/CanvasOverlays.tsx:536`
- Pattern: `title` (paired)
- Attached to: hide debug panel icon.

19. `src/playground/components/CanvasOverlays.tsx:545`
- Pattern: `title` (paired)
- Attached to: close debug panel icon.

20. `src/playground/components/CanvasOverlays.tsx:785`
- Pattern: `title`
- Attached to: debug HUD metric label `ghost:`.

21. `src/playground/components/CanvasOverlays.tsx:787`
- Pattern: `title`
- Attached to: debug HUD metric labels `C:` and `alpha:`.

22. `src/playground/components/CanvasOverlays.tsx:985`
- Pattern: `title`
- Attached to: debug test button (`Restart Same Seed`).

23. `src/playground/components/CanvasOverlays.tsx:993`
- Pattern: `title`
- Attached to: debug test button (new seed note).

24. `src/components/Sidebar.tsx:733`
- Pattern: `title`
- Attached to: collapsed sidebar open icon hit area.

25. `src/components/Sidebar.tsx:794`
- Pattern: `title`
- Attached to: expanded sidebar close icon.

26. `src/components/Sidebar.tsx:907`
- Pattern: `title`
- Attached to: session row text (subtitle hover reveal).

27. `src/components/Sidebar.tsx:960`
- Pattern: `title` (paired)
- Attached to: per-session row actions button.

28. `src/components/Sidebar.tsx:1289`
- Pattern: `title`
- Attached to: sidebar document viewer button.

29. `src/playground/components/MapTitleBlock.tsx:59`
- Pattern: `title`
- Attached to: main map title text (full title reveal).

30. `src/fullchat/FullChatToggle.tsx:69`
- Pattern: `title={undefined}`
- Attached to: full chat toggle (explicitly disabled tooltip).

### 1.2 `aria-label` usage (accessibility labels, sometimes used as tooltip text source)

1. `src/components/SendButton.tsx:54`
- Attached to: send button.

2. `src/fullchat/FullChatbar.tsx:740`
- Attached to: full chat close button.

3. `src/popup/MiniChatbar.tsx:468`
- Attached to: mini chat extend button.

4. `src/playground/components/TextPreviewButton.tsx:63`
- Attached to: document viewer toggle icon.

5. `src/playground/components/HalfLeftWindow.tsx:126`
- Attached to: document viewer close button.

6. `src/playground/components/SidebarControls.tsx:44`
- Attached to: debug sidebar close control.

7. `src/playground/components/CanvasOverlays.tsx:280`
- Attached to: show debug.

8. `src/playground/components/CanvasOverlays.tsx:297`
- Attached to: theme toggle.

9. `src/playground/components/CanvasOverlays.tsx:314`
- Attached to: controls toggle.

10. `src/playground/components/CanvasOverlays.tsx:344`
- Attached to: dev download JSON button.

11. `src/playground/components/CanvasOverlays.tsx:392`
- Attached to: top-right share icon.

12. `src/playground/components/CanvasOverlays.tsx:432`
- Attached to: top-right dots icon.

13. `src/playground/components/CanvasOverlays.tsx:535`
- Attached to: hide debug panel icon.

14. `src/playground/components/CanvasOverlays.tsx:544`
- Attached to: close debug panel icon.

15. `src/components/Sidebar.tsx:959`
- Attached to: sidebar row session actions button.

16. `src/components/FullscreenButton.tsx:45`
- Attached to: fullscreen entry/exit control.

17. `src/screens/Welcome2.tsx:459`
- Attached to: jump backward onboarding control.

18. `src/screens/Welcome2.tsx:475`
- Attached to: jump forward onboarding control.

19. `src/screens/Welcome2.tsx:494`
- Attached to: continue to prompt onboarding control.

20. `src/screens/appshell/overlays/ModalLayer.tsx:375`
- Attached to: close search button.

21. `src/ArnvoidDocumentViewer/engines/PdfEngine/PdfViewer.tsx:378`
- Attached to: previous page button.

22. `src/ArnvoidDocumentViewer/engines/PdfEngine/PdfViewer.tsx:387`
- Attached to: next page button.

23. `src/fullchat/FullChatToggle.tsx:68`
- Pattern: `aria-label={undefined}`
- Attached to: full chat toggle (explicitly disabled).

### 1.3 Tooltip component/library scan

- No tooltip library dependency found in `package.json` (no Tippy, Floating UI, Radix Tooltip, Material Tooltip, etc).
- No existing shared tooltip component/hook found.
- No `role="tooltip"`, no `aria-describedby`, no `data-tooltip` usage in app source.

### 1.4 i18n tooltip string keys (already present)

Tooltip-related translation keys are already defined in:
- `src/i18n/strings.ts:28` to `src/i18n/strings.ts:35`
- `src/i18n/strings.ts:125` to `src/i18n/strings.ts:132`

These can be reused by the custom tooltip engine without changing copy in run 2.

## 2) Key UI layers where tooltip must work

1. Sidebar collapsed and expanded
- File anchor: `src/components/Sidebar.tsx`
- Multiple icon-only controls and row menus currently rely on `title`.
- Contains scrollable session list (`overflowY: auto`) and fixed pop menus (`position: fixed`, z-index `LAYER_SIDEBAR_ROW_MENU`).

2. Graph canvas and graph-local overlays
- File anchors: `src/playground/GraphPhysicsPlaygroundShell.tsx`, `src/playground/components/CanvasOverlays.tsx`
- Graph root has pointer capture on `pointerdown`; overlays must stop propagation.
- Graph UI controls have current `title` usage and strict pointer/wheel shielding.

3. Modal and overlay layers
- File anchors: `src/screens/appshell/overlays/ModalLayer.tsx`, `src/screens/AppShell.tsx`
- Backdrops and modals hard-stop pointer/wheel; tooltip must never break this.

4. Document viewer
- File anchors: `src/playground/components/HalfLeftWindow.tsx`, `src/playground/components/TextPreviewButton.tsx`, `src/ArnvoidDocumentViewer/engines/PdfEngine/PdfViewer.tsx`
- Includes internal scrolling and PDF scale transforms.

## 3) Overlay/root structure and portal recommendation

### 3.1 Current root structure

From `src/screens/AppShell.tsx`:
- `SidebarLayer` mounted at shell root.
- Main content mounted in non-sidebar layer.
- `ModalLayer` mounted last, as top app-level overlay.

Graph subtree includes additional overlay systems:
- `CanvasOverlays` in graph scene.
- `PopupPortal` and `AIActivityGlyph` use `createPortal` to `document.body`.

### 3.2 Current z-index conventions (authoritative constants)

From `src/ui/layers.ts`:
- `LAYER_SIDEBAR = 50`
- `LAYER_ONBOARDING_FULLSCREEN_BUTTON = 1200`
- `LAYER_SIDEBAR_ROW_MENU = 1400`
- `LAYER_MODAL_SEARCH = 3100`
- `LAYER_MODAL_DELETE = 3200`
- `LAYER_MODAL_PROFILE = 3300`
- `LAYER_MODAL_LOGOUT_CONFIRM = 3400`
- `LAYER_OVERLAY_LOGIN = 5000`

Additional local values seen:
- Popup overlay container: z-index 1000 (`src/popup/PopupOverlayContainer.tsx`).
- Some graph local overlays: z-index 1200 (`CanvasOverlays` dots menu).
- AI activity glyph portal: z-index 9999 (`src/playground/components/AIActivityGlyph.tsx`).

### 3.3 Portal mount recommendation

Recommendation:
- Mount a `TooltipProvider` near AppShell root (same composition level as `ModalLayer`).
- Render tooltip surface through a dedicated portal to `document.body`.

Why:
- Avoid clipping from local overflow containers.
- Avoid transform/stacking issues in nested panes.
- Keep a single global tooltip layer and scheduler.

Proposed layer token for run 2:
- Add `LAYER_TOOLTIP` in `src/ui/layers.ts`.
- Place it above sidebar/menu and modal card content where needed, but below hard blockers like login overlay.
- Suggested initial value: `LAYER_TOOLTIP = 3450`.

Pointer safety:
- Tooltip root must use `pointerEvents: 'none'`.
- No wheel handlers on tooltip layer.
- Tooltip must never own interaction, only display.

## 4) Event model recommendation (hover/focus)

Use unified trigger model:
- Pointer: `onPointerEnter` and `onPointerLeave` for hover-capable devices.
- Keyboard: `onFocus` and `onBlur` for accessibility and non-pointer navigation.
- Optional close: `Escape` on focused anchor.

Not recommended for tooltip open logic:
- `onMouseMove` tracking loop.
- Continuous DOM reads in move handlers.

Why pointer events over mouse events:
- Consistent with existing input doctrine and modern pointer model.
- Better interoperability with touch/pens and mixed input.

Accessibility note:
- Keep `aria-label` as accessibility truth for controls.
- Tooltip text source should be explicit prop first, then optional fallback.
- Do not assume every `aria-label` should become visible tooltip.

## 5) Positioning constraints and perf constraints

### 5.1 Positioning constraints observed

1. Scroll containers
- Sidebar interfaces list scrolls (`src/components/Sidebar.tsx`).
- Search modal results scroll (`src/screens/appshell/overlays/ModalLayer.tsx`).
- Document viewer scroll containers (`src/ArnvoidDocumentViewer/styles.css`, `src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-engine.css`).

2. Transform wrappers
- Sidebar content uses translate transforms (`src/components/Sidebar.tsx`).
- Node popup and mini chat use scale/translate animations (`src/popup/NodePopup.tsx`, `src/popup/MiniChatbar.tsx`).
- PDF viewer uses scale transforms in render queue (`src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-viewer/hooks/usePdfRenderQueue.ts`).

3. Canvas/camera scale
- Graph itself is canvas-transformed by camera zoom; DOM tooltip anchored to DOM controls is straightforward.
- Future dot-level tooltip would need world->screen mapping, not DOM rect anchor.

### 5.2 Perf model for tooltip engine

Hard rule: no reflow loops.

Plan:
- Read anchor rect only on open and on bounded invalidation signals:
  - scroll (captured) throttled to about 50ms,
  - resize throttled to about 50ms,
  - anchor resize via `ResizeObserver`.
- Write tooltip position with `transform: translate3d(...)` and `position: fixed`.
- Do not measure in pointer move handlers.
- Keep one tooltip instance globally.
- Keep content and geometry in refs where possible; avoid broad rerenders.

Edge-aware positioning:
- Placement preference: top center.
- Flip to bottom when insufficient space.
- Shift along x/y to keep inside viewport with padding.
- Apply max width and text wrap guard.

## 6) Replacement plan and blast radius estimate

### 6.1 Replacement targets

Primary replacement set:
- All controls currently using `title=` for UI hints in:
  - `src/components/SendButton.tsx`
  - `src/components/PromptCard.tsx`
  - `src/fullchat/FullChatbar.tsx`
  - `src/popup/MiniChatbar.tsx`
  - `src/popup/NodePopup.tsx`
  - `src/playground/components/TextPreviewButton.tsx`
  - `src/playground/components/HalfLeftWindow.tsx`
  - `src/playground/components/AIActivityGlyph.tsx`
  - `src/playground/components/SidebarControls.tsx`
  - `src/playground/components/CanvasOverlays.tsx`
  - `src/components/Sidebar.tsx`
  - `src/playground/components/MapTitleBlock.tsx` (special case: full title reveal)

Secondary review set (aria-label only):
- `src/components/FullscreenButton.tsx`
- `src/screens/Welcome2.tsx`
- `src/screens/appshell/overlays/ModalLayer.tsx`
- `src/ArnvoidDocumentViewer/engines/PdfEngine/PdfViewer.tsx`

### 6.2 Blast radius estimate

Estimated impact:
- 15 to 20 files for direct tooltip migration.
- 1 to 3 new shared files for engine/provider/hook/component.
- 1 shared layer constant update file (`src/ui/layers.ts`).

Risk level: medium
- Wide touch surface, but low logic coupling if migration is mechanical.
- Main risk is input leakage on graph screen if wrappers are not pointer-safe.

## 7) Run 2 implementation plan (proposed)

### 7.1 Core artifacts

1. `TooltipProvider` + `TooltipPortal`
- Global provider mounted near AppShell root.
- Renders one tooltip instance in `document.body` portal.
- Uses design tokens required in this run:
  - font-size `10px`
  - padding `10px`
  - background `#0D0D18`

2. `useTooltip()` hook
- Provides anchor props:
  - `onPointerEnter`, `onPointerLeave`, `onFocus`, `onBlur`
- Accepts text and options (`placement`, offsets, disabled).
- Returns merged props helper to minimize file diffs.

3. Optional `<TooltipAnchor>` wrapper
- Lightweight wrapper for icon/button migration where prop spread is noisy.

4. Smart positioning utility
- `computeTooltipPosition(anchorRect, tooltipRect, viewport, preferredPlacement)`
- Implements flip and shift.
- Bounded updates only.

### 7.2 Migration strategy

1. Build engine and wire provider without changing callers.
2. Migrate high-value controls first (sidebar + graph overlays + chat close controls).
3. Remove corresponding `title=` attributes once migrated.
4. Preserve `aria-label` for accessibility.
5. Keep special semantic `title` uses only where required (for example, text truncation reveal if product still wants native behavior).

### 7.3 Verification plan for run 2

Manual checks:
- Sidebar collapsed and expanded controls.
- Graph top-right controls and debug panel controls.
- Node popup and mini chat controls.
- Modal search close button and profile/logout/delete modals.
- Document viewer controls.

Perf checks:
- No pointer-move driven layout reads.
- No tooltip-induced frame spikes while moving cursor across icon-dense areas.
- No pointer/wheel leaks to canvas when overlays are active.

Input safety checks:
- Tooltip layer must not intercept pointer events.
- Existing `stopPropagation` shield behavior remains unchanged.

## 8) Notes and exclusions in this run

- No code implementation performed (docs-only as requested).
- No browser automation or IDE browser testing tools used.
- Scan ignored minified third-party worker noise for tooltip logic conclusions.
