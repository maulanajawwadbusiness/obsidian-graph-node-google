# Report: Tooltip Smart Positioning (2026-02-15)

## Scope
Step 4 only: smart tooltip positioning and open-state anchor invalidation.

Included:
- tooltip size measurement,
- top-preferred placement with bottom flip,
- viewport shift/clamp,
- throttled anchor rect updates on resize/scroll while open.

Excluded:
- no `title=` migration,
- no animation/polish sweep,
- no new tooltip variants,
- no app-wide trigger rewiring changes.

## Files changed
- `src/ui/tooltip/TooltipProvider.tsx`
- `docs/report_tooltip_positioning_2026-02-15.md`

## Positioning algorithm summary
Implemented pure helper:
- `computeTooltipPosition({ anchorRect, tooltipSize, preferredPlacement })`

Constants:
- `VIEWPORT_MARGIN = 8`
- `TOOLTIP_GAP = 8`

Behavior:
1. Top candidate:
- `topCandidate = anchorRect.top - GAP - tooltipHeight`
2. Bottom candidate:
- `bottomCandidate = anchorRect.top + anchorRect.height + GAP`
3. Placement choice:
- prefer top if it fits,
- else bottom if it fits,
- else choose side with more room, then clamp.
4. Horizontal positioning:
- center from anchor midpoint,
- convert to left origin and clamp to viewport margins.
5. Final Y:
- clamp to viewport margins as final guard.

Renderer now uses top-left fixed positioning with:
- `left/top` from computed values,
- `transform: translate3d(0,0,0)`.

## Measurement and invalidation model

### Tooltip size measurement
- Bubble has `ref`.
- `useLayoutEffect` reads `offsetWidth/offsetHeight` when open/content/anchor changes.
- Size state updates only on real width/height changes.

### Bubble resize handling
- `ResizeObserver` on bubble while open.
- Observer callbacks are rAF-coalesced to avoid update spam.

### Anchor tracking while open
- When `showTooltip` gets `anchorEl`, provider stores it in ref (not state).
- Numeric `anchorRect` still stored in state for immediate render.
- While tooltip is open and anchor ref exists:
  - listen on `window.resize`
  - listen on captured `window.scroll` (`capture = true`)
  - optional `ResizeObserver` on anchor element
- All events schedule one rAF update at a time:
  - one `getBoundingClientRect()` read in that frame
  - state update only if rect actually changed.

## Perf guarantees
- No `mousemove` listeners.
- No continuous rAF loops.
- No per-frame sync layout reads.
- Rect reads only:
  - on `showTooltip` initial open,
  - on throttled invalidation events while open.

## Guards and safety
- Renderer only renders when:
  - `open`,
  - `anchorRect` exists,
  - `content.trim().length > 0`.
- `showTooltip` no-ops for empty content or missing anchor info.
- Anchor updates no-op when anchor ref is null/disconnected.
- Tooltip layer remains non-interactive:
  - portal host `pointerEvents: 'none'`
  - bubble `pointerEvents: 'none'`

## Verification run
Commands:
- `npm run build` -> pass.
- `npx vite --port 5174` -> timed out in this environment (no startup crash output before timeout).

