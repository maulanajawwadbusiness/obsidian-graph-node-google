# Global Font Switch: Quicksand

**Date:** 2026-01-29
**Author:** Antigravity

## Overview
Switched the entire application's typography to **Quicksand** (Google Fonts).

- **Default Weight:** 300 (Light) - elegant, airy feel.
- **Bold Weights:** 600/700 - available for emphasis.
- **Coverage:** React UI + Canvas Graph Labels.

## Implementation Details

### 1. Global CSS (`src/index.css`)
- **Import**: Added `@import` for Quicksand weights 300-700.
- **Root**: Set `font-family: 'Quicksand', ...` and `font-weight: 300`.
- **Reset**: Added a global reset for `button, input, select, textarea` to ensure `font-family: inherit` (browsers often default these to system-ui).

### 2. Canvas Theme (`src/visual/theme.ts`)
- **Normal Theme**: `labelFontFamily` -> `'Quicksand, sans-serif'`
- **Elegant Theme**: `labelFontFamily` -> `'Quicksand, sans-serif'`

## How to Verify
1.  **Visual Check**: Text should look rounded and thinner (Light 300).
2.  **DevTools**: Inspect any element computed styles -> `font-family` should start with `Quicksand`.
3.  **Canvas**: Zoom into a node. The label text should match the UI font.

## Future Note on Self-Hosting
Currently using Google Fonts (`fonts.googleapis.com`) for reliability. To switch to self-hosted:
1.  Download woff2 files for weights 300/400/500/600/700.
2.  Place in `public/fonts/`.
3.  Replace the `@import` in `index.css` with standard `@font-face` declarations.
