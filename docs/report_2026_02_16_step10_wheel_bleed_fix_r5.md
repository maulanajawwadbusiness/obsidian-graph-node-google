# Step 10 Wheel Bleed Fix Run 5

Date: 2026-02-16
Scope: marker audit + explicit scrollable marker standardization

## Marker audit results

1. Interactive overlay root marker remains on:
- `src/popup/NodePopup.tsx`
- `src/popup/MiniChatbar.tsx`
- `src/popup/ChatShortageNotif.tsx`

2. Non-interactive surfaces remain unmarked:
- `src/ui/tooltip/TooltipProvider.tsx` (`pointerEvents: none`)
- `src/popup/PopupOverlayContainer.tsx` (`pointerEvents: none`)

## New explicit scrollable marker

File: `src/components/sampleGraphPreviewSeams.ts`

Added:
1. `SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_ATTR`
2. `SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_VALUE`
3. `SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_SELECTOR`

Detection behavior update:
- wheel consumer scan now prefers explicit marked scroll containers first.
- falls back to computed-style overflow scan for unmarked ancestors.

## Applied explicit scrollable markers

1. `src/popup/NodePopup.tsx`
- content scroller (`overflowY: auto`) marked with `data-arnvoid-overlay-scrollable="1"`.

2. `src/popup/MiniChatbar.tsx`
- messages scroller (`overflowY: auto`) marked with `data-arnvoid-overlay-scrollable="1"`.

## Why

- reduces expensive style checks on common hot paths.
- makes intended scroll consumers explicit and auditable.

## Run 5 verification

- `npm run build` executed after changes.