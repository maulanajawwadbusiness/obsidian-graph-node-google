# Deep Forensic Report: Document Pipeline & Node Data

**Date**: 2026-01-28
**Scope**: End-to-End Analysis of "File Drop -> Node Knowledge -> Chat Context"

## 1. File Upload (The Entry Point)
**Trigger**: Drag & Drop on Canvas (`GraphPhysicsPlayground.tsx`).
-   **Event**: `handleDrop` intercepts the browser event.
-   **Action**: Calls `documentContext.parseFile(file)`.
-   **Execution**:
    -   The `WorkerClient` (`src/document/workerClient.ts`) spawns a Web Worker.
    -   The Worker selects a parser (`TextParser`, `PdfParser`, etc.) based on MIME type.
    -   **Result**: Raw text is extracted and returned to the main thread as `ParsedDocument`.
    -   **Storage**: The document is stored in `DocumentStore` (React Context), holding the *entire* parsed text in memory.

## 2. Processing & "Knowledge" Binding
Once the document is parsed, two parallel binding actions occur in `handleDrop`:

### A. The "Naive" Binding (Synchronous)
-   **Call**: `applyFirstWordsToNodes(engine, document)`
-   **Logic**: It splits the document string by whitespace and takes the **first 5 words**.
-   **Effect**: It immediately mutates `engine.nodes[i].label`.
-   **Forensic Finding**: **Only the label is updated.** The node object in `PhysicsEngine` (`PhysicsNode` interface) does **not** store any snippet, source reference, or semantic vector. It *only* knows its new display label.

### B. The AI Rewrite (Asynchronous)
-   **Call**: `applyAILabelsToNodes(...)`
-   **Logic**: Sends those same "first 5 words" to OpenAI.
-   **Effect**: Updates `engine.nodes[i].label` with the 3-word "poetic" version.
-   **Data Retention**: Again, **only the label changes**. The "knowledge" (original 5 words or source document) is discarded from the node itself.

## 3. Data Retention (Where is the info?)
**Critical Architecture Limitation**:
-   **Nodes are "Dumb"**: The `PhysicsNode` interface (`src/physics/types.ts`) has no field for `context`, `documentId`, `description`, or `embedding`.
-   **Knowledge Separation**:
    -   The **Document Store** holds the *Source of Truth* (the book).
    -   The **Physics Engine** holds the *Visuals* (the labels).
    -   **No Link**: There is no explicit link between `Node[i]` and `Document[i]`. The connection is purely implicit (Node 0 got Word 0).

## 4. MiniChat Connection (The "Missing Link")
**Current Implementation**: `src/popup/PopupStore.tsx` & `NodePopup.tsx`.
-   **State**: The popup knows `selectedNodeId`.
-   **Context**: When you open the popup, it displays `nodeLabel` by looking it up in the engine.
-   **Chat**: The `sendMessage` function in `PopupStore` is currently a **Mock**.
    -   It receives `text` (user input).
    -   It pushes a hardcoded mock response: *"This is a mock AI response..."*
    -   **It does NOT read the document.**
    -   **It does NOT read the node label.**
    -   **It does NOT use the AI Client.**

## 5. Summary & Recommendations

| Stage | Status | Findings |
| :--- | :--- | :--- |
| **Upload** | ✅ Robust | Worker-based parsing works well. |
| **Parsing** | ✅ Good | Supports PDF/Docx/Txt. |
| **Binding** | ⚠️ Weak | Naive "first 5 words" logic. No semantic extraction. |
| **Retention** | ❌ Missing | Nodes do not store context/origin. |
| **MiniChat** | ❌ Stub | No AI connection. No document awareness. |

**Immediate Next Steps for "Robust Analyzer":**
1.  **Enrich Nodes**: Update `PhysicsNode` type to include `context: { sourceText: string, docId: string }`.
2.  **Smart Extraction**: Replace "First 5 Words" with an AI call ("Extract 5 Key Concepts + Summaries").
3.  **Wire MiniChat**: Connect `PopupStore` to `FullChatAi` (or similar) to use the stored node context.
