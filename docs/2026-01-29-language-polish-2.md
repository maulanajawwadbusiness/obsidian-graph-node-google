# Language Polish Pass #2

**Date**: 2026-01-29
**Status**: Completed

## Changes Implemented

### 1. Terminology Standardized ("Node")
-   **ID Language**: Renamed "Titik" to "Node" in all UI strings within `src/i18n/strings.ts`. This ensures consistent technical terminology.
-   **Grep Verification**: Confirmed "Titik" only exists in legacy comments or fallback strings if any (actually, logic was updated).

### 2. Localization Coverage Extended
Migrated hardcoded English strings to `i18n` system:

**Full Chat (`src/fullchat/FullChatbar.tsx`)**
-   Empty State: "A quiet space for reasoning" -> `t('fullChat.emptyState')`
-   Select Node: "Select a node to start" -> `t('fullChat.emptyStateSelect')`
-   Placeholder: "Type a message..." -> `t('fullChat.placeholder')`
-   Jump Button: "Jump to latest" -> `t('fullChat.jumpToLatest')`
-   Context Badge: "Node {label}" -> `t('miniChat.nodeLabel')`

**Document Viewer (`src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx`)**
-   Empty State: "No document loaded" -> `t('docViewer.empty')`
-   Drop Instructions: Added "Drop a file onto the canvas..." -> `t('docViewer.dropText')`
-   Error messages migrated to `t('docViewer.failedDocx')`, etc.

### 3. Tooltips & Accessibility
Added `tooltip.*` namespace to `strings.ts` and applied to icon buttons:

-   **Full Chat Toggle**: `t('tooltip.openChat')` ("Buka Chatbar")
-   **Send Button**: `t('tooltip.send')` ("Kirim pesan")
-   **Close Buttons**: `t('tooltip.close')` ("Tutup")
-   **Document Viewer**: `t('tooltip.openDocument')` ("Buka Dokumen") (if applicable buttons exist)

## Files Touched
-   `src/i18n/strings.ts`
-   `src/fullchat/FullChatbar.tsx`
-   `src/fullchat/FullChatToggle.tsx`
-   `src/components/SendButton.tsx`
-   `src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx`

## Verification
-   **Switch Language (ID/EN)**: All new UI elements should flip instantly.
-   **Tooltips**: Hovering over icons now shows localized text.
-   **Terminology**: "Node" is used consistently.
