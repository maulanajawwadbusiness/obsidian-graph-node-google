# Font Unification Runbook (Run 1)

Date: 2026-02-03

## Scope
Run 1 is scan-only: inventory existing font wiring, identify risks, and outline the plan for Runs 2–10.

## Inventory (Current Font Wiring)

| Area | File | Current Setting | Notes |
| --- | --- | --- | --- |
| Global @font-face | `src/index.css` | `@font-face` for `Quicksand` w/ `src: url('/Quicksand-Light.ttf')` | Uses absolute path from public root; only Light weight defined. |
| Global default font | `src/index.css` | `:root { font-family: 'Quicksand', Inter, system-ui, ... }` | Global font set at `:root`. |
| Playground container | `src/playground/graphPlaygroundStyles.ts` | `fontFamily: "'Quicksand', Inter, system-ui, ..."` | Inline override on main container. |
| Graph label theme | `src/visual/theme.ts` | `labelFontFamily: 'Quicksand, system-ui, -apple-system, sans-serif'` | Used by canvas label drawing (see `graphDraw.ts`). |
| Canvas label drawing | `src/playground/rendering/graphDraw.ts` | `ctx.font = \`${theme.labelFontSize}px ${theme.labelFontFamily}\`` | Label font is tied to theme font; other debug uses monospace. |
| Canvas debug monospace | `src/playground/rendering/graphDraw.ts` | `ctx.font = 'bold 20px monospace'`, `ctx.font = '9px monospace'`, `ctx.font = '10px monospace'` | Non-UI debug/readouts are monospace; may need review in later runs. |
| Document viewer (text) | `src/ArnvoidDocumentViewer/styles.css` | `.arnvoid-text { font-family: var(--font-mono, ... ) }` | Text pane uses monospace variable. |
| Document viewer (PDF engine) | `src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-engine.css` | `.pdf-engine { font-family: var(--font-sans, "Segoe UI", ... ) }` | PDF engine uses its own sans stack. |

## Font Assets (Current)
- `public/Quicksand-Light.ttf`
- `src/assets/Quicksand-Light.ttf`

The global `@font-face` in `src/index.css` references `/Quicksand-Light.ttf`, which resolves to the **public** asset. No Calibri assets are bundled.

## Calibri Availability Risk
Calibri is not bundled and is not reliably installed on non-Windows devices. We need an explicit fallback strategy:
- **Option A (stack-only):** `font-family: Calibri, Carlito, Arial, sans-serif` (Carlito is metric-compatible but not guaranteed to be installed).
- **Option B (bundle alternative):** Add Carlito font assets via `@font-face` to guarantee cross-device consistency.

Decision deferred to Runs 2–8 based on repo policy and desired consistency.

## Risks / Override Hotspots
1. **Inline font overrides** in `graphPlaygroundStyles.ts` can override global defaults and create non-obvious precedence.
2. **Per-component CSS** in `ArnvoidDocumentViewer` uses different font stacks (`--font-mono`, `--font-sans`).
3. **Canvas text** uses `theme.labelFontFamily` and direct `ctx.font` strings; if fonts are not loaded early, text may render with fallback.
4. **Global CSS order**: `src/index.css` is a catch-all. Future overrides can unintentionally replace the default font unless the “steel assurance” layer is loaded last.

## Proposed “Steel Assurance” Design
Create a single source of truth in a dedicated stylesheet (e.g. `src/styles/fonts.css`) with:
- `@font-face` declarations for Quicksand (bundled assets)
- CSS variables:
  - `--font-ui` (Quicksand stack)
  - `--font-title` (Calibri stack or Calibri+Carlito bundle)
- Global defaults (html, body, inputs, buttons, select, textarea): `font-family: var(--font-ui)`
- Per-panel toggles via data attribute:
  - `[data-font="ui"] { font-family: var(--font-ui); }`
  - `[data-font="title"] { font-family: var(--font-title); }`

## Run Plan (Runs 2–10)

### Run 2 — Add robust local font assets + @font-face
**Target files**: `public/` or `src/assets/`, new `src/styles/fonts.css`, `src/main.tsx` or `src/index.css` (import).
- Confirm the preferred font file location.
- Define `@font-face` for Quicksand with `font-display: swap`.

### Run 3 — Create global font variables + default UI font
**Target files**: `src/styles/fonts.css`, `src/index.css` (import order).
- Define `--font-ui` and `--font-title` on `:root`.
- Set `html, body, input, button, select, textarea { font-family: var(--font-ui); }`.

### Run 4 — Panel-level toggle mechanism
**Target files**: panel roots in `src/fullchat/`, `src/popup/`, `src/ArnvoidDocumentViewer/`, and any top-level overlay containers.
- Apply `data-font="ui"` on major panel roots.
- Add `data-font` selectors in `fonts.css`.

### Run 5 — Calibri-only titles
**Target files**: title components in `src/fullchat/` and `src/ArnvoidDocumentViewer/`.
- Set `data-font="title"` on “Reasoning” and “Document Viewer” labels only.

### Run 6 — Remove conflicting font-family rules
**Target files**: `src/index.css`, `src/ArnvoidDocumentViewer/*.css`, `src/playground/graphPlaygroundStyles.ts`.
- Replace ad-hoc font-family declarations with variables/toggles.

### Run 7 — Canvas text verification
**Target files**: `src/playground/rendering/graphDraw.ts`, `src/visual/theme.ts`.
- Ensure label font explicitly references Quicksand in the theme and uses the bundled font.

### Run 8 — Cross-device Calibri fallback strategy
**Target files**: `src/styles/fonts.css` (and possible new font assets if bundling Carlito).
- Implement Calibri stack or bundled Carlito.

### Run 9 — Anti-override guarantee
**Target files**: `src/main.tsx` (import order) and `src/styles/fonts.css`.
- Ensure fonts stylesheet loads last and add a comment block forbidding `font-family` elsewhere.

### Run 10 — Final doc + revert checkpoints
**Target files**: `docs/report_2026_02_03_font_unification_runbook.md`.
- Add final architecture summary and revert guidance for each run.

