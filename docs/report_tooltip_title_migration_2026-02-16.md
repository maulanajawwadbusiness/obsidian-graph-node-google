# Tooltip Title Migration Report (2026-02-16)

## Scope
Step 6 migration from native `title=` tooltips to the custom tooltip engine (`useTooltip(...).getAnchorProps(...)`).

## Commands Run
- `rg -n "title=" src --glob "*.tsx"`
- `npm run build`

Result:
- Build passed (`tsc` + `vite build`).
- Native `title=` in app surfaces removed except one documented exception.

## Migrated Files
- `src/components/SendButton.tsx`
- `src/components/PromptCard.tsx`
- `src/fullchat/FullChatbar.tsx`
- `src/fullchat/FullChatToggle.tsx` (removed `title={undefined}` no-tooltip noop)
- `src/popup/MiniChatbar.tsx`
- `src/popup/NodePopup.tsx`
- `src/playground/components/TextPreviewButton.tsx`
- `src/playground/components/HalfLeftWindow.tsx`
- `src/playground/components/AIActivityGlyph.tsx`
- `src/playground/components/SidebarControls.tsx`
- `src/playground/components/CanvasOverlays.tsx`
- `src/components/Sidebar.tsx`

Approx migrated/removal count: 29 `title=` usages (including noop `title={undefined}` removal).

## Exception Left
- `src/playground/components/MapTitleBlock.tsx`
  - Left as native `title={mainText}` by exception.
  - Reason: the title block intentionally uses `pointerEvents: 'none'` to protect canvas input. Migrating it to custom tooltip would require making that surface interactive and risks violating overlay/input doctrine. Keeping this single exception avoids input leakage risk.

## Z-Index Notes
- No z-index changes were required in this migration run.
- Existing tooltip layer stack remains unchanged.

## Safety Notes
- Existing pointer shielding and stopPropagation behavior were preserved.
- No mousemove or rAF tooltip tracking was introduced in consumers.
