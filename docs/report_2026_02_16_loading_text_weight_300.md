# Loading Text Weight 300 Hardening (2026-02-16)

## Scope
- Enforce `font-weight: 300` for all loading-surface text.
- Eliminate weight leaks across graph loading gate, legacy loading screen, and runtime fallbacks.

## Files Changed
- `src/styles/loadingTypography.ts`
- `src/screens/appshell/render/GraphLoadingGate.tsx`
- `src/screens/LoadingScreen.tsx`
- `src/components/AnalysisOverlay.tsx`
- `src/screens/appshell/appShellStyles.ts`
- `scripts/check-loading-text-weight.mjs`
- `package.json`
- `docs/system.md`
- `docs/repo_xray.md`

## What Changed
1. Added shared loading typography tokens:
   - `LOADING_TEXT_FONT_WEIGHT = 300`
   - `LOADING_TEXT_FONT_FAMILY = 'var(--font-ui)'`
2. Applied tokenized weight to all gate loading text styles:
   - center status text
   - error title and message
   - back button label
   - confirm slot label and confirm button label
3. Applied tokenized weight to:
   - legacy `LoadingScreen` text
   - `AnalysisOverlay` loading text
   - graph runtime fallback text via `FALLBACK_STYLE`
4. Added guard script:
   - `npm run test:loading-typography`
   - fails if loading text weight drifts from 300 in covered files.

## Verification
- `npm run test:loading-typography`
- `npm run build`

## Contract Lock
- All loading-surface text must remain at weight `300`.
- Future loading UI additions must use `src/styles/loadingTypography.ts`.
