/**
 * Arnvoid UI Strings Dictionary
 * Flat keys for type-safety.
 */

export const STRINGS = {
    id: {
        // Node Popup
        "nodePopup.header": "Analisis Node",
        "nodePopup.closeTooltip": "Tutup jendela",
        "nodePopup.fallbackTitle": "Node {id}",
        "nodePopup.fallbackSummary": "Tidak ada analisis detail untuk node ini.",
        "nodePopup.inputPlaceholder": "Analisis ini lebih lanjut",

        // Mini Chat
        "miniChat.header": "Analisis Mini",
        "miniChat.closeTooltip": "Tutup",
        "miniChat.extendTooltip": "Debatkan ke Pembicaraan Utama",
        "miniChat.extendAria": "Kirim ke Pembicaraan Utama",
        "miniChat.nodeLabel": "Node {label}",
        "miniChat.fallbackNode": "node ini",

        // Text Preview
        "textPreview.open": "Buka Dokumen (Beta)",
        "textPreview.close": "Tutup Penampil",

        // Tooltips
        "tooltip.close": "Tutup",
        "tooltip.openChat": "Buka Pembicaraan",
        "tooltip.closeChat": "Tutup Chat",
        "tooltip.send": "Kirim",
        "tooltip.uploadDoc": "Unggah Dokumen",
        "tooltip.openViewer": "Buka penampil dokumen",
        "tooltip.closeViewer": "Tutup penampil dokumen",
        "tooltip.jumpToLatest": "Loncat ke pesan terbaru",

        // Full Chat
        "fullChat.placeholder": "Debatkan kesulitanmu di paper ini", // Inferred commonly needed
        "fullChat.jumpToLatest": "Loncat ke terbaru",
        "fullChat.emptyStateTitle": "Menalarkan",
        "fullChat.emptyStateDesc": "Ruang tenang untuk berpikir.",
        "fullChat.emptyStateThinking": "Memikirkan {label}",
        "fullChat.emptyStateTrace": "Telusuri pertanyaan Anda di sini.",
        "fullChat.emptyStateTraceDefault": "Ragukan pertanyaanmu, atau mulai langsung di sini.",

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

        // Onboarding Welcome1
        "onboarding.welcome1.brand_title_line1": "Arnvoid",
        "onboarding.welcome1.brand_title_line2": "Antarmuka Pengetahuan Dua Dimensi",
        "onboarding.welcome1.fullscreen_prompt.title": "Aktifkan antarmuka dalam mode layar penuh?",
        "onboarding.welcome1.fullscreen_prompt.desc": "Layar penuh menjaga tampilan onboarding tetap stabil dan imersif.",
        "onboarding.welcome1.fullscreen_prompt.cta_yes": "Ya, aktifkan",
        "onboarding.welcome1.fullscreen_prompt.cta_no": "Tidak, tetap di layar ini",

        // Onboarding Welcome2
        "onboarding.welcome2.manifesto": `Untukku, aku sering merasa lelah ketika membaca paper di jam 2 malam. {p=260}
Menurutku teks itu bukanlah bentuk pengetahuan paling intuitif. {p=900}

Kita sudah membaca teks selama 50 tahun di hidup kita.
Jika kita ingin memproses pengetahuan secara intuitif, kurasa kita perlu menciptakan bentuk medium informasi yang baru untuk diri kita sendiri.
Medium yang cocok dengan pikiran kita. Yang selaras dengan saraf alami di dalam pikiran kita. {p=900}

Kupikir ini waktunya untuk kita memikirkan medium informasi yang berbeda di sini.`,

        // Onboarding EnterPrompt
        "onboarding.enterprompt.sidebar_label": "Sidebar",
        "onboarding.enterprompt.graph_preview_placeholder": "Pratinjau graf contoh",
        "onboarding.enterprompt.heading": "Telusuri kesulitan di dalam papermu di sini",
        "onboarding.enterprompt.input_placeholder": "Tempel atau unggah dokumenmu untuk mulai melakukan analisis di sini",
        "onboarding.enterprompt.login.title": "Masuk",
        "onboarding.enterprompt.login.desc": "Kamu akan bisa menggunakan antarmuka pengetahuan cerdas Arnvoid.",
        "onboarding.enterprompt.login.status_checking": "Memeriksa sesi...",
        "onboarding.enterprompt.login.signed_in_label": "Sudah masuk",
        "onboarding.enterprompt.login.user_unknown": "tidak diketahui",
        "onboarding.enterprompt.login.button_hide": "Sembunyikan",
        "onboarding.enterprompt.login.button_back": "Kembali",
        "onboarding.enterprompt.login.button_continue": "Lanjutkan",
        "onboarding.enterprompt.login.button_skip": "Lewati",
        "onboarding.enterprompt.login.google.signed_in_as": "Masuk sebagai",
        "onboarding.enterprompt.login.google.button_logout": "Keluar",
        "onboarding.enterprompt.login.google.status_missing_api_base": "VITE_API_BASE_URL belum diatur",
        "onboarding.enterprompt.login.google.status_got_token": "Token Google diterima, mengirim ke backend...",
        "onboarding.enterprompt.login.google.status_no_credential": "Tidak ada kredensial dari Google",
        "onboarding.enterprompt.login.google.status_backend_rejected": "Backend menolak status={status}",
        "onboarding.enterprompt.login.google.status_ok_logged_in": "Berhasil masuk",
        "onboarding.enterprompt.login.google.status_error": "Error: {error}",
        "onboarding.enterprompt.login.google.status_failed": "Login Google gagal",
    },
    en: {
        // Node Popup
        "nodePopup.header": "Node Info",
        "nodePopup.closeTooltip": "Close window",
        "nodePopup.fallbackTitle": "Node {id}",
        "nodePopup.fallbackSummary": "No detailed analysis available for this node.",
        "nodePopup.inputPlaceholder": "Analyze this further",

        // Mini Chat
        "miniChat.header": "Mini Analysis",
        "miniChat.closeTooltip": "Close",
        "miniChat.extendTooltip": "Extend to main conversation",
        "miniChat.extendAria": "Send to Full Analysis",
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
        "fullChat.placeholder": "Trace your map through conversation",
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

        // Onboarding Welcome1
        "onboarding.welcome1.brand_title_line1": "Arnvoid",
        "onboarding.welcome1.brand_title_line2": "2 Dimensional Knowledge Interface",
        "onboarding.welcome1.fullscreen_prompt.title": "Activate interface in full-screen mode?",
        "onboarding.welcome1.fullscreen_prompt.desc": "Full-screen keeps the onboarding view stable and immersive.",
        "onboarding.welcome1.fullscreen_prompt.cta_yes": "Yes, activate",
        "onboarding.welcome1.fullscreen_prompt.cta_no": "No, stay in this screen",

        // Onboarding Welcome2
        "onboarding.welcome2.manifesto": `For me, i often feel tired reading paper at 2 am.{p=260}
I think text is not the most intuitive form of knowledge.{p=900}

We have been reading text for more than 50 years.
If we want to process information intuitively, i think we need to create a new form of information medium for ourselves.
One that fit our mind well. One that fit natural nerve in our thought.{p=900}

I think it is time for us to think a different medium for ourselves.`,

        // Onboarding EnterPrompt
        "onboarding.enterprompt.sidebar_label": "Sidebar",
        "onboarding.enterprompt.graph_preview_placeholder": "Sample graph preview",
        "onboarding.enterprompt.heading": "Delve Uncertainties in Your Paper Here",
        "onboarding.enterprompt.input_placeholder": "Try out beta of the world's first 2D Knowledge Interface",
        "onboarding.enterprompt.login.title": "Sign In",
        "onboarding.enterprompt.login.desc": "You'll be able to use Arnvoid's smart knowledge interface.",
        "onboarding.enterprompt.login.status_checking": "Checking session...",
        "onboarding.enterprompt.login.signed_in_label": "Signed in",
        "onboarding.enterprompt.login.user_unknown": "unknown",
        "onboarding.enterprompt.login.button_hide": "Hide",
        "onboarding.enterprompt.login.button_back": "Back",
        "onboarding.enterprompt.login.button_continue": "Continue",
        "onboarding.enterprompt.login.button_skip": "Skip",
        "onboarding.enterprompt.login.google.signed_in_as": "Signed in as",
        "onboarding.enterprompt.login.google.button_logout": "Logout",
        "onboarding.enterprompt.login.google.status_missing_api_base": "VITE_API_BASE_URL is missing",
        "onboarding.enterprompt.login.google.status_got_token": "Got Google token, sending to backend...",
        "onboarding.enterprompt.login.google.status_no_credential": "No credential from Google",
        "onboarding.enterprompt.login.google.status_backend_rejected": "Backend rejected status={status}",
        "onboarding.enterprompt.login.google.status_ok_logged_in": "Ok: logged in",
        "onboarding.enterprompt.login.google.status_error": "Error: {error}",
        "onboarding.enterprompt.login.google.status_failed": "Google login failed",
    }
} as const;
