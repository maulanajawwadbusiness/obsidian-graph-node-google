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
        "nodePopup.inputPlaceholder": "Telusuri ini lebih lanjut",

        // Mini Chat
        "miniChat.header": "Analisis Mini",
        "miniChat.closeTooltip": "Tutup",
        "miniChat.extendTooltip": "Lanjut ke Obrolan Utama",
        "miniChat.extendAria": "Kirim ke Obrolan Utama",
        "miniChat.nodeLabel": "Node {label}",
        "miniChat.fallbackNode": "node ini",

        // Text Preview
        "textPreview.open": "Buka Dokumen (Beta)",
        "textPreview.close": "Tutup Penampil",

        // Tooltips
        "tooltip.close": "Tutup",
        "tooltip.openChat": "Buka Chatbar",
        "tooltip.closeChat": "Tutup Chat",
        "tooltip.send": "Kirim",
        "tooltip.uploadDoc": "Unggah Dokumen",
        "tooltip.openViewer": "Buka penampil dokumen",
        "tooltip.closeViewer": "Tutup penampil dokumen",
        "tooltip.jumpToLatest": "Loncat ke pesan terbaru",

        // Full Chat
        "fullChat.placeholder": "Telusuri pikiran di sini...", // Inferred commonly needed
        "fullChat.jumpToLatest": "Loncat ke terbaru",
        "fullChat.emptyStateTitle": "Berpikir",
        "fullChat.emptyStateDesc": "Ruang tenang untuk berpikir.",
        "fullChat.emptyStateThinking": "Memikirkan {label}",
        "fullChat.emptyStateTrace": "Telusuri pikiran Anda di sini.",
        "fullChat.emptyStateTraceDefault": "Pilih sebuah node, atau mulai langsung.",

        // Document Viewer
        "docViewer.title": "Penampil Dokumen",
        "docViewer.empty": "Tidak ada dokumen yang dimuat.",
        "docViewer.dropInstruction": "Tarik & Lepas file ke layar (sebelah kanan) untuk melihat.",
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
        "nodePopup.inputPlaceholder": "Trace it further...",

        // Mini Chat
        "miniChat.header": "Mini Chat",
        "miniChat.closeTooltip": "Close",
        "miniChat.extendTooltip": "Extend to main chat",
        "miniChat.extendAria": "Send to Full Chat",
        "miniChat.nodeLabel": "Node {label}",
        "miniChat.fallbackNode": "this node",

        // Text Preview
        "textPreview.open": "Open Document (Beta)",
        "textPreview.close": "Close Viewer",

        // Tooltips
        "tooltip.close": "Close",
        "tooltip.openChat": "Open Chat",
        "tooltip.closeChat": "Close Chat",
        "tooltip.send": "Send",
        "tooltip.uploadDoc": "Upload Document",
        "tooltip.openViewer": "Open document viewer",
        "tooltip.closeViewer": "Close document viewer",
        "tooltip.jumpToLatest": "Jump to latest",

        // Full Chat
        "fullChat.placeholder": "Trace the thought here...",
        "fullChat.jumpToLatest": "Jump to latest",
        "fullChat.emptyStateTitle": "Reasoning",
        "fullChat.emptyStateDesc": "A quiet space for reasoning",
        "fullChat.emptyStateThinking": "Thinking about {label}",
        "fullChat.emptyStateTrace": "Trace your thoughts here.",
        "fullChat.emptyStateTraceDefault": "Select a node, or begin directly.",

        // Document Viewer
        "docViewer.title": "Document Viewer",
        "docViewer.empty": "No document loaded.",
        "docViewer.dropInstruction": "Drop a file onto the canvas (right side) to view.",
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
