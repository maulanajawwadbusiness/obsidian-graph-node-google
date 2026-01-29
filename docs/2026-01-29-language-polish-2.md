# Language Polish Pass #2 (Fix Report)

**Date**: 2026-01-29
**Status**: Completed

## Changes Implemented

### 1. Terminology Standardized ("Node")
-   **ID Language**: Renamed "Titik" to "Node" in all UI strings within `src/i18n/strings.ts`. This ensures consistent technical terminology.

### 2. Localization Coverage Extended
Migrated hardcoded English strings to `i18n` system:

**Full Chat (`src/fullchat/FullChatbar.tsx`)**
-   **Header**: "Reasoning" -> `t('fullChat.header')`
-   **Placeholder**: "Trace the thought here..." -> `t('fullChat.placeholder')`
-   **Empty State Title**: "A quiet space for reasoning" -> `t('fullChat.emptyState')`
-   **Empty State Sub**: "Select a node, or begin directly" -> `t('fullChat.emptyStateSelect')`
-   **Context Title**: "Thinking about {label}" -> `t('fullChat.thinkingAbout')`
-   **Context Sub**: "Trace your thoughts here." -> `t('fullChat.traceThoughts')`

**Document Viewer (`src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx`)**
-   Empty State: "No document loaded" -> `t('docViewer.empty')`
-   Drop Instructions: Added "Drop a file onto the canvas..." -> `t('docViewer.dropText')`

### 3. Tooltips & Accessibility
Added `tooltip.*` namespace to `strings.ts` and applied to icon buttons:

-   **Full Chat Toggle**: `t('tooltip.openChat')` ("Buka Chatbar")
-   **Send Button**: `t('tooltip.send')` ("Kirim pesan")
-   **Close Buttons**: `t('tooltip.close')` ("Tutup")
-   **Document Viewer**: `t('tooltip.openDocument')` ("Buka Dokumen")

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
