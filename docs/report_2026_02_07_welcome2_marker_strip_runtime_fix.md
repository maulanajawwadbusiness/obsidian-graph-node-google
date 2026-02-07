# Welcome2 Marker Strip Runtime Fix

Date: 2026-02-07
Scope: Fix runtime rendering so authored marker tokens do not appear in Welcome2 UI.

## Findings Confirmed

1. `src/screens/Welcome2.tsx` rendered raw `MANIFESTO_TEXT`, so `{p=...}` tokens were visible.
2. Timeline builder existed, but `renderText` was not consumed by Welcome2 runtime path.

## Fix Applied

File changed:
- `src/screens/Welcome2.tsx`

Changes:
- Imported `buildWelcome2Timeline` from `src/screens/welcome2Timeline.ts`.
- Added memoized derived text:
  - `const manifestoRenderText = React.useMemo(() => buildWelcome2Timeline(MANIFESTO_TEXT).renderText, []);`
- Updated render path to use `manifestoRenderText` instead of raw `MANIFESTO_TEXT`.

## Result

- Markers remain in source text for authored rhythm (`src/screens/welcome2ManifestoText.ts`).
- UI now renders marker-stripped text only.
- Runtime behavior matches timeline builder contract and prior documentation intent.

## Verification

- Build passed (`npm run build`).
- Manual code check confirms `welcome2-manifesto-text` now uses stripped output.
- No audio or typing engine behavior was introduced in this fix.
