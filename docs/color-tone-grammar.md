# Color Tone Grammar - Panel Surfaces

## Base Tone (Dark Panels)
- Base background: #13131D
- Source of truth: `--panel-bg-rgb` in `src/index.css` (19, 19, 29).
- Why: cool navy-leaning gray that harmonizes with blue node glow.

## Secondary Surfaces
- Sheet surface (dark): base +2 to +3 luma, same hue direction.
- Example: #151520 (RGB 21, 21, 32) for sheet background.

## Border Grammar
- Default divider/border: rgba(75, 80, 100, 0.22)
- Use for subtle separators (header lines, section divides).
- Avoid high-contrast borders unless explicitly needed.

## Shadow Grammar
- Outer shadow (panel): 2-3 layers, cool black with soft falloff in the same ink family.
- Example:
  - 0 8px 32px rgba(0, 0, 0, 0.4)
  - 0 2px 8px rgba(0, 0, 0, 0.25)
- Inner shadow / sheet edge cue:
  - inset 0 1px 3px rgba(0, 0, 0, 0.1)
  - inset 0 0 12px rgba(0, 0, 0, 0.05)

## Overlay Grammar
- Hover overlay: small opacity lift, same hue family.
- Focus outline: cool blue accent (matches node glow).
- Modal overlay: darken using base tone + low alpha, do not shift hue.

## Do / Don't
- Do keep all dark panel surfaces in the #13131D family.
- Do derive lighter surfaces by increasing luma only, not hue shift.
- Don't introduce green-leaning neutrals like #14161E for panel bases.
- Don't mix unrelated grays across panels.

## Current Source of Truth
- Base panel RGB: `--panel-bg-rgb` in `src/index.css` (19, 19, 29).
- Viewer sheet background: `DOC_THEME_DARK.sheetBg` in `src/document/viewer/docTheme.ts`.
- Popup base: `POPUP_STYLE.backgroundColor` in `src/popup/NodePopup.tsx` (uses `rgb(var(--panel-bg-rgb))`).

## hue direction contract (arnvoid sacred tone)

### core doctrine
arnvoid’s sacred dark-tone direction is **blue-leaning ink**.
any drift toward **green-leaning neutral** is a hard aesthetic failure.

### why this exists
arnvoid’s graph + nodes emit blue/cyan energy. panel surfaces must harmonize with that field.
greenish neutrals break harmony and read as:
- detached / “not part of the organism”
- flat, dead, paper-like
- visually disgusting on the arnvoid membrane

### hard rules (non-negotiable)
1) **all primary panel bases in dark mode MUST be blue-leaning**
   - canonical base: `#13131D`
   - any new panel base must be derived from this family (same hue direction)

2) **green-leaning dark grays are forbidden as base surfaces**
   - examples of “bad drift”: bases that visually resemble `#14161E` behavior
   - if a panel looks “swamp / olive / flat green-gray”, reject it immediately

3) **do not mix unrelated gray families across components**
   - node popup, document viewer, side panels, modals must share the same ink family
   - mixing families creates a “ransacked thrownaway paper” effect

### practical checks (agent checklist)
when adding or modifying any panel surface:

A) **side-by-side test**
- open node popup + the new panel simultaneously
- if they don’t feel like the same material, it’s wrong

B) **blue-field compatibility test**
- view the panel with blue node glow behind it
- if the panel reads detached or dirty, suspect green drift

C) **first-suspect rule**
if something looks “shit/disgusting” on the membrane, first suspect:
> **green hue contamination**
before suspecting typography, spacing, or shadows.

### implementation guidance (how agents should act)
- treat `#13131D` as the root “ink”.
- all panel background variants must be small lightness shifts of the same hue direction.
- shadows/borders must also be tinted within the same ink family (no neutral/green shadows).

### acceptance criteria
a change passes only if:
- panel base reads as blue-ink dark, not neutral-green dark
- popup + panel look like siblings (same organism)
- the panel does not look like “thrownaway paper” under blue glow
