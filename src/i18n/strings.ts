/**
 * Arnvoid UI Strings Dictionary
 * Flat keys for type-safety.
 */

export const STRINGS = {
    id: {
        // Node Popup
        "nodePopup.header": "Info Titik",
        "nodePopup.closeTooltip": "Tutup jendela",
        "nodePopup.fallbackTitle": "Titik {id}",
        "nodePopup.fallbackSummary": "Tidak ada analisis detail untuk titik ini.",
        "nodePopup.inputPlaceholder": "Tanyakan lebih lanjut",

        // Mini Chat
        "miniChat.header": "Obrolan Singkat",
        "miniChat.closeTooltip": "Tutup",
        "miniChat.extendTooltip": "Lanjut ke Obrolan Utama",
        "miniChat.extendAria": "Kirim ke Obrolan Utama",
        "miniChat.nodeLabel": "Titik {label}",
        "miniChat.fallbackNode": "titik ini",

        // Full Chat
        "fullChat.placeholder": "Ketik pesan...", // Inferred commonly needed
        "fullChat.jumpToLatest": "Loncat ke terbaru",

        // Document Viewer
        "docViewer.empty": "Tidak ada dokumen yang dimuat.",
        "docViewer.unsupportedPdf": "Sumber PDF tidak didukung.",
        "docViewer.failedDocx": "Gagal memuat DOCX ({status}).",
        "docViewer.failedText": "Gagal memuat teks ({status}).",

        // Generic / Common
        "common.error": "Terjadi kesalahan.",
        "common.loading": "Memuat...",

        // AI Strings
        "ai.seedPromptNew": "Ceritakan lebih lanjut tentang \"{label}\"",
        "ai.seedPromptContinue": "Dalam konteks \"{label}\", melanjutkan...",
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

        // Document Viewer
        "docViewer.empty": "No document loaded.",
        "docViewer.unsupportedPdf": "Unsupported PDF source.",
        "docViewer.failedDocx": "Failed to fetch DOCX ({status}).",
        "docViewer.failedText": "Failed to fetch text ({status}).",

        // Generic / Common
        "common.error": "An error occurred.",
        "common.loading": "Loading...",

        // AI Strings
        "ai.seedPromptNew": "Tell me more about \"{label}\"",
        "ai.seedPromptContinue": "In context of \"{label}\", continuing...",
    }
} as const;
