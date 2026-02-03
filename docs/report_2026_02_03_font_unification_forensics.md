# Forensic Report: Font Unification Status (Case #8514)

**Date:** 2026-02-03
**Scope:** Verification of "Run 1" inventory and assessment of Runs 2–10 status.

## Executive Summary
The codebase state is significantly **ahead** of the "Inventory" section described in `docs/report_2026_02_03_font_unification_runbook.md`. It appears that **Runs 2, 3, 4, and 5** (and parts of 8/9) have already been substantially implemented.

The "Inventory" in the runbook appears to describe a prior state (or a hypothetical baseline) that does not match the current `main` branch.

## 1. Inventory Discrepancies

| Feature | Runbook Claim | Actual Codebase State | Status |
| :--- | :--- | :--- | :--- |
| **Global Fonts** | Defined in `src/index.css` | Defined in `src/styles/fonts.css` | **Implemented** (Run 2/3) |
| **@font-face** | `src: url('/Quicksand-Light.ttf')` (absolute) | `src: url('../assets/Quicksand-Light.ttf')` (relative) | **Implemented** |
| **Variables** | None listed | `--font-ui`, `--font-title` in `fonts.css` | **Implemented** (Run 3) |
| **Panel Toggles** | None listed | `data-font="ui"`, `data-font="title"` usage found | **Implemented** (Run 4/5) |
| **Container Style** | Inline override in `src/playground/graphPlaygroundStyles.ts` | No inline override in `CONTAINER_STYLE` | **Clean** |

## 2. Implementation Status Checklist

Based on the Runbook's "Run Plan", here is the current status:

- [x] **Run 2 (Assets + @font-face)**: `src/styles/fonts.css` exists, loads `Quicksand-Light.ttf` from `src/assets`.
- [x] **Run 3 (Global Variables)**: `--font-ui` and `--font-title` are defined in `:root`. `body` uses `--font-ui`.
- [x] **Run 4 (Panel Toggles)**: `data-font` attributes are present in:
    - `src/popup/NodePopup.tsx`
    - `src/popup/MiniChatbar.tsx`
    - `src/playground/components/HalfLeftWindow.tsx`
    - `src/fullchat/FullChatbar.tsx`
    - `src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx`
- [x] **Run 5 (Calibri Titles)**: `data-font="title"` is applied to specific title elements in `FullChatbar` and `HalfLeftWindow`.
- [?] **Run 6 (Remove Conflicts)**:
    - `graphPlaygroundStyles.ts` appears clean (uses `inherit`).
    - `src/visual/theme.ts` still has hardcoded font stacks (`ELEGANT_THEME.labelFontFamily`).
- [?] **Run 7 (Canvas Verification)**:
    - Canvas still uses `theme.labelFontFamily`. It does NOT use the CSS variable directly (due to Canvas API limitations), so it relies on the theme strings matching the CSS definition.
- [?] **Run 8 (Calibri Fallback)**:
    - `fonts.css` uses `Calibri, Carlito, Segoe UI...`.
    - **Note:** `Carlito` is NOT bundled (only `Quicksand` is in `src/assets`). This matches "Option A" (stack only), not "Option B" (bundled).
- [x] **Run 9 (Anti-override)**:
    - `src/main.tsx` imports `fonts.css` AFTER `index.css`.
    - `fonts.css` header comment: `/* Font system single source of truth... */`.

## 3. Risks & Recommendations

1.  **Theme Sync**: `src/visual/theme.ts` defines `labelFontFamily` string manually.
    - *Risk*: If `fonts.css` changes `--font-ui`, the Canvas labels won't update automatically.
    - *Recommendation*: Ensure `theme.ts` strings match `fonts.css` perfectly, or consider a mechanism to read the variable (hard in pure TS config).

2.  **Missing Carlito**: Runbook mentioned "Calibri is not bundled... We need an explicit fallback strategy".
    - Current state uses stack-only. If `Carlito` is desired for non-Windows, it needs to be downloaded and `@font-face` added.

3.  **Runbook Update:** The provided runbook should be updated to reflect that Runs 2-5 are done, and focus should shift to Verification (Theme sync, visual check).

## 4. Conclusion
Work Case #8514 is closer to completion than the runbook implies. The next effective step is **not** to start Run 2, but to **verify Run 6, 7, and 8** (Theme alignment and Fallback strategy).
