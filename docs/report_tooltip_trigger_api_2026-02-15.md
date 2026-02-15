# Report: Tooltip Trigger API (2026-02-15)

## Scope
Step 3 only: add caller-facing trigger hook so components can request tooltip show/hide through the global tooltip controller.

No migration in this step:
- no `title=` removals,
- no full surface wiring sweep,
- no smart positioning changes,
- no tooltip animation changes.

## Files changed
- `src/ui/tooltip/useTooltip.ts`
- `docs/report_tooltip_trigger_api_2026-02-15.md`

## API signature
New hook:
- `useTooltip(content: string, options?: UseTooltipOptions): UseTooltipResult`

Options:
- `disabled?: boolean`
- `placement?: 'top'`
- `sourceId?: string`

Return:
- `getAnchorProps<T extends React.HTMLAttributes<HTMLElement>>(props?: T): T`

## Event model
Handlers attached by `getAnchorProps`:
- `onPointerEnter` -> `showTooltip({ content, anchorEl: e.currentTarget, placement, sourceId })`
- `onPointerLeave` -> `hideTooltip()`
- `onFocus` -> `showTooltip(...)`
- `onBlur` -> `hideTooltip()`
- `onKeyDown` -> if `Escape`, `hideTooltip()`

Composition:
- Existing caller handlers are preserved.
- Helper `composeHandlers(a, b)` executes both handlers in order (caller first, tooltip second).
- No propagation changes or event swallowing.

## Perf notes
- No `onMouseMove` usage.
- No `requestAnimationFrame` loop.
- Hook does not read layout.
- Rect read remains only inside `showTooltip` in provider (`getBoundingClientRect()` once at show).

## Accessibility and behavior notes
- Hook does not infer tooltip text from `aria-label`.
- Caller remains responsible for explicit tooltip content.
- Existing `aria-label` and other props are preserved by `getAnchorProps`.

## Deferred to later steps
- Step 4: smart positioning (flip/shift/clamp/edge-aware).
- Step 5: migration and polish across app surfaces.

## Verification
Command run:
- `npm run build` -> pass.

