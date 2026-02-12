# Report: Quicksand Woff2 Multi-Weight Migration (2026-02-12)

## Scope
- Organized Quicksand font source files into `src/assets/fonts/quicksand/`.
- Added deterministic `woff2` outputs for 400/500/600/700.
- Updated `src/styles/fonts.css` to register Quicksand multi-weight with `font-display: swap`.
- Updated CSS font vars so `--font-ui` and `--font-title` use Quicksand stacks.

## File Layout
- `src/assets/fonts/quicksand/Quicksand-Regular.ttf`
- `src/assets/fonts/quicksand/Quicksand-Medium.ttf`
- `src/assets/fonts/quicksand/Quicksand-SemiBold.ttf`
- `src/assets/fonts/quicksand/Quicksand-Bold.ttf`
- `src/assets/fonts/quicksand/Quicksand-Regular.woff2`
- `src/assets/fonts/quicksand/Quicksand-Medium.woff2`
- `src/assets/fonts/quicksand/Quicksand-SemiBold.woff2`
- `src/assets/fonts/quicksand/Quicksand-Bold.woff2`

## Generation Method
Generated `woff2` files from TTF using `pyftsubset`:

```powershell
pyftsubset src/assets/fonts/quicksand/Quicksand-Regular.ttf --output-file=src/assets/fonts/quicksand/Quicksand-Regular.woff2 --flavor=woff2 --unicodes=*
pyftsubset src/assets/fonts/quicksand/Quicksand-Medium.ttf --output-file=src/assets/fonts/quicksand/Quicksand-Medium.woff2 --flavor=woff2 --unicodes=*
pyftsubset src/assets/fonts/quicksand/Quicksand-SemiBold.ttf --output-file=src/assets/fonts/quicksand/Quicksand-SemiBold.woff2 --flavor=woff2 --unicodes=*
pyftsubset src/assets/fonts/quicksand/Quicksand-Bold.ttf --output-file=src/assets/fonts/quicksand/Quicksand-Bold.woff2 --flavor=woff2 --unicodes=*
```

## Weight Mapping
- 400 -> `Quicksand-Regular.woff2`
- 500 -> `Quicksand-Medium.woff2`
- 600 -> `Quicksand-SemiBold.woff2`
- 700 -> `Quicksand-Bold.woff2`

## Verification
- `npm run build` passes.
- Quicksand `woff2` assets are emitted into build output.
- `src/main.tsx` imports `src/styles/fonts.css` once.

## Rollback
- Revert commits:
  - `chore(fonts): organize quicksand font assets`
  - `feat(fonts): add quicksand woff2 multi-weight`
  - `feat(fonts): register quicksand via fonts.css and css vars`
  - `docs(fonts): report quicksand woff2 migration`
