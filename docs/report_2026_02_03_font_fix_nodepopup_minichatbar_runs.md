# Font Fix & Public Sans Runbook (Runs 1–10)

**Date**: 2026-02-03
**Case**: #8514 (Font Unification + Public Sans Fallback)

## Run 1: Scandissect (Findings)

### Inventory
| Component | File | Current Status | Issues |
| :--- | :--- | :--- | :--- |
| **Node Popup** | `src/popup/NodePopup.tsx` | `data-font="ui"` present. | `POPUP_STYLE` has hardcoded `fontFamily: 'system-ui...'`. |
| **Node Popup Title** | `src/popup/NodePopup.tsx` | Uses `LABEL_STYLE`. | Missing `data-font="title"`. |
| **Mini Chatbar** | `src/popup/MiniChatbar.tsx` | `data-font="ui"` present. | `CHATBAR_STYLE` has hardcoded `fontFamily: 'system-ui...'`. |
| **Full Chatbar Title** | `src/fullchat/FullChatbar.tsx` | `data-font="title"` present. | `TITLE_STYLE` has `fontWeight: 500` (Needs 700/Bold). |
| **Doc Viewer Title** | `src/playground/components/HalfLeftWindow.tsx` | `data-font="title"` present. | `TITLE_STYLE` lacks `fontWeight` (inherits 300). Needs 700. |
| **Fonts CSS** | `src/styles/fonts.css` | Exists with `@font-face`. | Needs Public Sans update. |
| **Public Sans** | `src/assets/fonts/` | Missing. | Need to create dir and add `@font-face`. |

### Action Plan
- **Run 2**: Remove `fontFamily` from `MiniChatbar.tsx`.
- **Run 3**: Remove `fontFamily` from `NodePopup.tsx`.
- **Run 4**: Add `data-font="title"` to Node Popup header.
- **Run 5**: Update `fonts.css` vars (`--font-title`, `--font-title-weight`).
- **Run 6**: Update `HalfLeftWindow.tsx` style (fontWeight).
- **Run 7**: Update `FullChatbarStyles.ts` style (fontWeight).
- **Run 8**: Verification pass (skipped if clean).
- **Run 9**: Bundle Public Sans (create dir, add `@font-face`).
- **Run 10**: Final verify & commit.

## Run Log
- **Run 1**: Inventory checks passed.
- **Run 2**: Removed hardcoded `fontFamily` from `MiniChatbar.tsx`.
- **Run 3**: Removed hardcoded `fontFamily` from `NodePopup.tsx`.
- **Run 4**: Applied `data-font="title"` to Node Popup header label.
- **Run 5**: Updated `src/styles/fonts.css` with new stack (Segoe UI -> Public Sans) and weight variable (700).
- **Run 6**: Updated `HalfLeftWindow.tsx` title style to use `var(--font-title-weight)`.
- **Run 7**: Updated `FullChatbarStyles.ts` title style to use `var(--font-title-weight)`.
- **Run 8**: No conflicts found (handled in 2/3).
- **Run 9**: Created `src/assets/fonts/public-sans` and added `README_FONTS.md`. Configured `@font-face` in `fonts.css`. **Action Expected**: User must drop font files.
