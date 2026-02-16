# Report: Tooltip Surface Look (2026-02-16)

## Scope
Step 5 only: style the tooltip bubble surface.

No behavior changes:
- positioning algorithm unchanged,
- event model unchanged,
- no `title=` migration,
- no animation/polish sweep beyond baseline surface styling.

## Files changed
- `src/ui/tooltip/TooltipProvider.tsx`
- `docs/report_tooltip_surface_look_2026-02-16.md`

## Styling choices applied
Updated tooltip bubble style in `TOOLTIP_BUBBLE_STYLE_BASE`:
- text color: `#E7EEF8` for readability on dark background
- border radius: `8px` (small, clean)
- subtle border: `1px solid rgba(215, 245, 255, 0.14)`
- subtle shadow: `0 6px 18px rgba(0, 0, 0, 0.28)`
- line-height: `1.35` for stable readability
- max width: `280px` to avoid oversized long-label bubbles
- wrapping:
  - `whiteSpace: 'normal'`
  - `wordBreak: 'break-word'`

## Required token confirmation
Tokens retained exactly:
- `font-size: 10px`
- `padding: 10px`
- `background: #0D0D18`

## Pointer safety confirmation
Tooltip remains fully non-interactive:
- portal host: `pointerEvents: 'none'`
- tooltip bubble: `pointerEvents: 'none'`

No pointer/wheel handlers were added to tooltip layer.

## Perf/safety notes
- Styling-only changes, no new event loops.
- No mousemove or per-frame measurement logic introduced by this step.
- Existing `translate3d(0,0,0)` remains unchanged.

## Verification
Command run:
- `npm run build` -> pass.

