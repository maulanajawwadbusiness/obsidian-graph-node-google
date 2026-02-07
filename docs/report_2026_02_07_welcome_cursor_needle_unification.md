# Welcome Cursor Needle Unification (Step 4)

Date: 2026-02-07
Scope: unify onboarding cursor between Welcome1 and Welcome2 using one shared needle component.

## Cursor Before

- `src/screens/Welcome1.tsx` used a literal `|` with local style and blink animation.
- `src/screens/Welcome2.tsx` used a separate literal `|` with a different local style.

Result: screen-to-screen cursor feel was not guaranteed identical.

## Shared Component Added

File:
- `src/components/TypingCursor.tsx`

Exports:
- `type TypingCursorMode = 'normal' | 'typing' | 'pause' | 'holdFast'`
- `TypingCursor` component props:
  - `mode?: TypingCursorMode`
  - `visible?: boolean`
  - `heightEm?: number`
  - `style?: React.CSSProperties`

All onboarding cursor visuals now come from this component.

## Needle CSS and Blink Modes

Needle look is defined in component style:
- `width: 2px`
- `display: inline-block`
- `background: #63abff`
- `borderRadius: 1px`
- `verticalAlign: -0.12em`
- `willChange: opacity`
- no literal `|` character

Animation keyframes added in `src/index.css`:
- `cursorNeedleNormal`
- `cursorNeedlePause`
- `cursorNeedleHoldFast`
- `cursorNeedleTyping`

Mode mapping in component:
- `typing` -> near-solid subtle pulse
- `pause` -> slower blink
- `holdFast` -> faster blink for short hold emphasis
- `normal` -> standard blink

## Welcome2 Phase To Cursor Mode

In `src/screens/Welcome2.tsx`, cursor mode is derived locally from `useTypedTimeline` outputs:
- `phase === 'typing'`:
  - if no char advance for `>130ms`, mode `pause`
  - otherwise mode `typing`
- `phase === 'hold'`:
  - first `680ms` in hold uses `holdFast`
  - then mode `normal`
- `phase === 'done'`:
  - mode `normal`

This keeps the cursor tactile and intentional while preserving timeline engine logic.

## Wiring Changes

- `src/screens/Welcome1.tsx` now uses `TypingCursor` instead of local `|`.
- `src/screens/Welcome2.tsx` now uses `TypingCursor` with phase-driven mode mapping.
- `src/index.css` now owns the cursor keyframes used by both screens.

## Guarded Logs

Welcome2 includes guarded cursor-mode transition logs:
- `DEBUG_WELCOME2_CURSOR = false` by default.
- When enabled, logs mode transitions with `[Welcome2Type]`.

## Verification Notes

- Build passed with `npm run build`.
- Both screens now share one cursor implementation.
- Cursor rendering uses opacity-only animations to avoid reflow jitter.
- No audio code added.
