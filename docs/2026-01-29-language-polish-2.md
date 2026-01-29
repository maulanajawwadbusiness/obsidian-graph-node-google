# Language Polish Pass #2 Report

**Date**: 2026-01-29
**Status**: Completed

## Summary
Refactored the codebase to standardize terminology and enforce full localization for tooltips and empty states.

## Terminology Changes
- **"Titik" -> "Node"**: Verified and replaced throughout `src/i18n/strings.ts`.
  - Indonesian users will now see "Node n1", "Info Node", etc., matching technical preference.

## Localization Coverage
### 1. Tooltips & Aria Labels
Added explicit `t()` support for all icon buttons:
- **FullChatbar**: Close, Jump to Latest, Send.
- **FullChatToggle**: Main floating toggle.
- **NodePopup**: Close button.
- **MiniChatbar**: Close button.
- **TextPreviewButton**: Open/Close viewer logic.

**New Keys:**
- `tooltip.close`, `tooltip.openChat`, `tooltip.closeChat`, `tooltip.send`
- `tooltip.openViewer`, `tooltip.closeViewer`
- `textPreview.open`, `textPreview.close`

### 2. FullChat Empty States
Migrated hardcoded "Reasoning space" strings to i18n:
- `fullChat.emptyStateTitle`: "Ruang Nalar"
- `fullChat.emptyStateDesc`: "Pilih sebuah node..."
- `fullChat.emptyStateThinking`: "Memikirkan {label}"
- `fullChat.emptyStateTrace`: "Telusuri pikiran Anda di sini."

### 3. Document Viewer
Migrated empty states and instructions:
- `docViewer.title`: "Penampil Dokumen"
- `docViewer.empty`: "Tidak ada dokumen yang dimuat."
- `docViewer.dropInstruction`: "Tarik & Lepas file..."

## Verification
- **Grep**: No literal "Titik" found in source (outside `git` history).
- **Files**:
  - `src/i18n/strings.ts`: Updated.
  - `src/fullchat/FullChatbar.tsx`: Localized.
  - `src/fullchat/FullChatToggle.tsx`: Localized.
  - `src/playground/components/HalfLeftWindow.tsx`: Localized.
  - `src/playground/components/TextPreviewButton.tsx`: Localized.
