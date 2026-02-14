# Welcome2 Seek Button Icon Swap (Arrow Left/Right)

Date: 2026-02-14

## Scope
- Replace text seek labels `[<-]` and `[->]` with arrow icons in Welcome2.
- Keep existing button actions and pointer-shield behavior unchanged.

## Assets Used
- Left icon: `src/assets/arrow_left.png`
- Right icon: `src/assets/arrow_right.png`

## Changes
- File: `src/screens/Welcome2.tsx`

1. Added imports:
   - `arrowLeftIcon`
   - `arrowRightIcon`

2. Replaced button labels with icon spans:
   - Left button now renders a masked icon from `arrow_left.png`.
   - Right button now renders a masked icon from `arrow_right.png`.

3. Added accessibility labels:
   - left: `aria-label="Jump backward"`
   - right: `aria-label="Jump forward"`

4. Added icon constants:
   - `SEEK_ICON_SIZE_PX = 16`
   - `SEEK_ICON_COLOR = '#9db7e2'`

5. Updated seek button layout for icon centering:
   - fixed size button box (`38x30`)
   - `display: inline-flex`
   - centered content with zero internal padding

6. Added mask icon style:
   - uses `WebkitMaskImage` and `maskImage`
   - tint driven by `SEEK_ICON_COLOR`
   - no-repeat, centered, contain fit

## Preserved Behavior
- `[<-]` still calls existing back-jump flow (`handleSeekRestartSentence`).
- `[->]` still calls finish flow (`handleSeekFinishSentence`).
- Pointerdown stopPropagation on both buttons remains unchanged.
- No changes to typing/cadence/stabilize logic.

## Verification
- `npm run build` passed.

## Manual Validation Checklist
1. Confirm left/right icons render in the two seek buttons.
2. Confirm icons are visually centered in button bounds.
3. Confirm click behavior unchanged for both seek buttons.
4. Confirm no pointer leakage to parent container.
5. Confirm keyboard activation still works on both buttons.
