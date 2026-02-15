# Report: Tooltip Step 1-2 Verification (2026-02-15)

## Scope
Verification mini-run for tooltip Step 1 and Step 2:
- foundation layer and portal mount,
- global singleton engine core and controller API.

## Commands run and results
1. `npm run build`
- Result: pass.
- Notes: existing Vite warnings about chunk size and `"use client"` from dependency, no tooltip-specific errors.

2. Script availability check (`package.json`)
- `typecheck` script: not present.
- `lint` script: not present.
- Per instruction, only existing scripts were run.

3. `npm run dev`
- Result: failed to start on default port.
- Error: port `5173` already in use.

4. `npm run dev -- --port 4173` and `npx vite --port 4173`
- Result: command timed out in this terminal session (no startup crash trace emitted before timeout).
- Manual click-through interaction verification could not be fully executed in this non-interactive terminal-only environment.

5. Static verification query:
- Searched `src/ui/tooltip/TooltipProvider.tsx` for:
  - `position: 'fixed'`
  - `inset: 0`
  - `zIndex: LAYER_TOOLTIP`
  - `pointerEvents: 'none'`
  - no mousemove/rAF patterns
- Result: invariants confirmed.

## Risks found and outcome
1. Risk: renderer visibility invariant was implicit, not explicit.
- Before: renderer condition checked `open` and `anchorRect`, but not `content.trim()`.
- Impact: low, but explicit guard is safer if state were mutated unexpectedly.
- Action taken: added explicit `state.content.trim().length === 0` guard in renderer.

2. DOM safety
- Portal already guarded by `if (typeof document === 'undefined') return null;`.
- No module-import side effects requiring DOM access.

3. Null/invalid anchor safety
- `showTooltip` behavior is safe:
  - empty/whitespace content: no-op,
  - missing both `anchorRect` and `anchorEl`: no-op,
  - `anchorEl` null/undefined: no-op.

4. State clearing
- `hideTooltip` clears `open`, `content`, and `anchorRect`.

## What changed in this mini-run
- `src/ui/tooltip/TooltipProvider.tsx`
  - Added explicit renderer guard:
    - render only when `open && anchorRect && content.trim().length > 0`.

- `docs/report_tooltip_step1_2_verification_2026-02-15.md`
  - This verification report.

## Invariant confirmation
1. Portal host style includes:
- `position: fixed`
- `inset: 0`
- `zIndex: LAYER_TOOLTIP`
- `pointerEvents: 'none'`

2. Tooltip bubble style includes:
- `pointerEvents: 'none'`

3. No layout-thrash loops:
- no `mousemove` listeners,
- no `requestAnimationFrame` loops,
- `getBoundingClientRect()` read only on `showTooltip` when `anchorEl` is used.

4. Interaction leakage posture:
- Tooltip layer is non-interactive (`pointerEvents: none` end-to-end), so it cannot consume pointer/wheel events.
- Static code posture is consistent with sidebar/modal/graph interaction safety.

