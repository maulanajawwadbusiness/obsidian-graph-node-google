/**
 * Arnvoid UI Strings Dictionary
 * Flat keys for type-safety.
 */

export const STRINGS = {
    id: {
        // Node Popup
        "nodePopup.header": "Info Node",
        "nodePopup.closeTooltip": "Tutup jendela",
        "nodePopup.fallbackTitle": "Node {id}",
        "nodePopup.fallbackSummary": "Tidak ada analisis detail untuk node ini.",
        "nodePopup.inputPlaceholder": "Tanyakan lebih lanjut",

        // Mini Chat
        "miniChat.header": "Obrolan Singkat",
        "miniChat.closeTooltip": "Tutup",
        "miniChat.extendTooltip": "Lanjut ke Obrolan Utama",
        "miniChat.extendAria": "Kirim ke Obrolan Utama",
        "miniChat.nodeLabel": "Node {label}",
        "miniChat.fallbackNode": "node ini",

        // Full Chat
        "fullChat.placeholder": "Ketik pesan...",
        "fullChat.jumpToLatest": "Loncat ke terbaru",
        "fullChat.emptyState": "Ruang tenang untuk menalar.",
        "fullChat.emptyStateSelect": "Pilih node untuk memulai.",
        "fullChat.loading": "Berpikir...",

        // Document Viewer
        "docViewer.empty": "Tidak ada dokumen yang dimuat.",
        "docViewer.unsupportedPdf": "Sumber PDF tidak didukung.",
        "docViewer.failedDocx": "Gagal memuat DOCX ({status}).",
        "docViewer.failedText": "Gagal memuat teks ({status}).",
        "docViewer.dropText": "Seret file ke kanvas...",

        // Generic / Common
        "common.error": "Terjadi kesalahan.",
        "common.loading": "Memuat...",

        // AI Strings
        "ai.seedPromptNew": "Ceritakan lebih lanjut tentang \"{label}\"",
        "ai.seedPromptContinue": "Dalam konteks \"{label}\", melanjutkan...",

        // Tooltips
        "tooltip.openChat": "Buka Chatbar",
        "tooltip.send": "Kirim pesan",
        "tooltip.close": "Tutup",
        "tooltip.openDocument": "Buka Dokumen",
        "tooltip.uploadFile": "Unggah File",
    },
    en: {
        // Node Popup
        "nodePopup.header": "Node Info",
        "nodePopup.closeTooltip": "Close window",
        "nodePopup.fallbackTitle": "Node {id}",
        "nodePopup.fallbackSummary": "No detailed analysis available for this node.",
        "nodePopup.inputPlaceholder": "Ask about it further",

        // Mini Chat
        "miniChat.header": "Mini Chat",
        "miniChat.closeTooltip": "Close",
        "miniChat.extendTooltip": "Extend to main chat",
        "miniChat.extendAria": "Send to Full Chat",
        "miniChat.nodeLabel": "Node {label}",
        "miniChat.fallbackNode": "this node",

        // Full Chat
        "fullChat.placeholder": "Type a message...",
        "fullChat.jumpToLatest": "Jump to latest",
        "fullChat.emptyState": "A quiet space for reasoning.",
        "fullChat.emptyStateSelect": "Select a node to start.",
        "fullChat.loading": "Thinking...",

        // Document Viewer
        "docViewer.empty": "No document loaded.",
        "docViewer.unsupportedPdf": "Unsupported PDF source.",
        "docViewer.failedDocx": "Failed to fetch DOCX ({status}).",
        "docViewer.failedText": "Failed to fetch text ({status}).",
        "docViewer.dropText": "Drop a file onto the canvas...",

        // Generic / Common
        "common.error": "An error occurred.",
        "common.loading": "Loading...",

        // AI Strings
        "ai.seedPromptNew": "Tell me more about \"{label}\"",
        "ai.seedPromptContinue": "In context of \"{label}\", continuing...",

        // Tooltips
        "tooltip.openChat": "Open Chatbar",
        "tooltip.send": "Send message",
        "tooltip.close": "Close",
        "tooltip.openDocument": "Open Document",
        "tooltip.uploadFile": "Upload File",
    }
} as const;
