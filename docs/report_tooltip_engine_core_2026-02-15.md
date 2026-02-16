# Report: Tooltip Engine Core (2026-02-15)

## Scope
Step 2 only: implement the global tooltip engine core inside `TooltipProvider`.

Included:
- singleton tooltip state,
- controller API (`showTooltip`, `hideTooltip`) via context,
- single tooltip renderer in the existing body portal host.

Excluded in this step:
- no `title=` migration,
- no trigger-props hook sweep,
- no smart positioning (flip/shift/clamp),
- no animation polish.

## Files changed
- `src/ui/tooltip/TooltipProvider.tsx`
- `docs/report_tooltip_engine_core_2026-02-15.md`

## TooltipState shape
Defined in `TooltipProvider.tsx`:
- `open: boolean`
- `content: string`
- `anchorRect: { left: number; top: number; width: number; height: number } | null`
- `placement: 'top'`
- `sourceId?: string`

## Controller API
Context API exposed via `useTooltipController()`:

- `showTooltip(input)`
  - input fields:
    - `content: string`
    - `anchorEl?: Element | null`
    - `anchorRect?: { left: number; top: number; width: number; height: number }`
    - `placement?: 'top'`
    - `sourceId?: string`
  - behavior:
    - trims `content`,
    - resolves rect from `anchorRect` directly or from `anchorEl.getBoundingClientRect()`,
    - stores numeric rect snapshot and opens tooltip.

- `hideTooltip()`
  - closes tooltip and clears content and anchor rect.

- `isOpen: boolean`

## Renderer and portal behavior
- Portal remains mounted in `document.body` via `createPortal`.
- Root host style remains:
  - `position: fixed`
  - `inset: 0`
  - `zIndex: LAYER_TOOLTIP`
  - `pointerEvents: 'none'`

- Single tooltip instance renders only when `state.open` and rect exists.
- Current deterministic positioning:
  - `x = anchorRect.left + anchorRect.width / 2`
  - `y = anchorRect.top`
  - style:
    - `position: fixed`
    - `left/top` from x/y
    - `transform: translate(-50%, -100%)`
    - `font-size: 10px`
    - `padding: 10px`
    - `background: #0D0D18`
    - `pointerEvents: 'none'`

## Perf notes
- Rect read happens only in `showTooltip` when `anchorEl` is provided.
- No window mousemove listeners.
- No rAF loops.
- No per-frame layout reads.

## Deferred to later steps
- Step 3: trigger API wiring for controls and surfaces (prop helpers/hook usage sweep).
- Step 4: smart positioning (flip/shift/clamp/edge aware).
- Step 5: migration pass from native `title=` and polish.

