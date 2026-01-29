# Arnvoid UI Strings & AI Prompt Forensics

This report identifies the locations of UI texts and AI prompt logic across the Arnvoid application.

## 1. UI Components

### A. Node Popup
**File**: `src/popup/NodePopup.tsx`
*   **Header Label**: `"Node Info"` (Line 224)
*   **Close Button**: Tooltip `"Close window"` (Line 230).
*   **Dynamic Content**:
    *   Title: `content?.title` or fallback `Node [ID]` (Line 199).
    *   Body: `content?.summary` or fallback `"No detailed analysis available for this node."` (Line 200).
*   **Input Placeholder**: `"Trace it further..."` (Line 246).

### B. MiniChat Panel
**File**: `src/popup/MiniChatbar.tsx`
*   **Header Label**: `"Mini Chat"` (Line 346).
*   **Close Button**: Tooltip `"Close"` (Line 357).
*   **Input Placeholder**: `"Trace it further..."` (Line 398).
*   **Action Buttons**:
    *   Extend to Full Chat: Tooltip `"Extend to main chat"` and aria-label `"Send to Full Chat"` (Line 403-404).

### C. FullChatbar Panel
**File**: `src/fullchat/FullChatbar.tsx`
*   **Thinking Indicator**: `StreamingDots` component rendering `· · ·` (Lines 247-253).
*   **Jump Button**: `"Jump to latest"` styled via `JUMP_TO_LATEST_STYLE` (Line 207).
*   **Empty State**: (Inferred from UI logic) Typically displayed when no messages exist.

### D. Document Viewer
**File**: `src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx`
*   **Empty State**: `"No document loaded."` (Line 331).
*   **Error Messages**: 
    *   `"Unsupported PDF source."` (Line 138).
    *   `"Failed to fetch DOCX (${response.status})."` (Line 155).
    *   `"Failed to fetch text (${response.status})."` (Line 184).

---

## 2. Prefill Input System

**File**: `src/fullchat/prefillSuggestion.ts`

### Seed Prompts (Instant)
Generated in `makeSeedPrompt` (Lines 20-28):
*   **Fresh start**: `Tell me more about "${nodeLabel}"`
*   **Continuing conversation**: `In context of "${nodeLabel}", continuing...`

### Refinement Prompt (AI Output Logic)
**Mock Mode** (Lines 61-70):
*   `Analyze "${nodeLabel}" and explain its connections within the graph framework.`
*   `Synthesize the discussion regarding "${nodeLabel}", focusing on the point: "${shortSummary}"`

**Real Mode (System Prompt)** (Lines 95-103):
```text
You are generating ONE suggested prompt to prefill a chat input.
Rules:
- One line only.
- Actionable and specific to the node.
- No prefixes like "suggested prompt:".
- No quotes.
- Max 160 characters.
- Tone: calm, analytical, dark-elegant.
- Return ONLY the prompt text.
```

---

## 3. System Prompt (Responses API)

**File**: `src/fullchat/fullChatAi.ts`
**Function**: `buildSystemPrompt` (Lines 148-174)

The prompt follows a "Dark Elegant" doctrine:
*   **Intro**: `"You are a dark, elegant AI assistant in a tool called Arnvoid."`
*   **Strict Style**: `"Style: Concise, analytical, mysterious but helpful. No fluff."`
*   **Context Injections**:
    *   `- Focused Node: "${nodeLabel}"`
    *   `- Active Document: "${documentTitle}"`
    *   `- Document Excerpt: """${safeText}"""...`
*   **History**: Appends the last 6 turns of conversation under `Conversation History:`.
