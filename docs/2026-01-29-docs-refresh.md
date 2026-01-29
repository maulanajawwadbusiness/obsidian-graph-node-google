# Docs Refresh & Architecture Sync

**Date**: 2026-01-29
**Goal**: Update core documentation to reflect the current state of the AI pipeline, UI layers, and developer doctrine.

## Summary of Changes

### 1. `docs/system.md`
*   **Pipeline Synced**: Added the "Paper Essence Pipeline" (Analyzer -> Nodes -> Knowledge).
*   **UI Layers**: Updated order and ownership. Explicitly mentioned `AnalysisOverlay` as the highest layer for shielding.
*   **AI Architecture**: Documented `paperAnalyzer`, `fullchatAi`, and `minichatAi` modules.
*   **Doctrine**: Defined "Context Doctrine" (Node Knowledge vs Document Context).

### 2. `docs/handoff.md`
*   **Payload V2**: Added the `content` (Title + Summary) field to the schema.
*   **Preservation Logic**: Documented how `FullChatbar` prioritizes handoff context over generic document text.
*   **Forensic Checklist**: Added new troubleshooting sections for "The Drift" and "The Zombie".

### 3. `AGENTS.md` (Root)
*   **Tool Warnings**: HARD warning against `task_boundary` and browser testing tools.
*   **PowerShell Caution**: Explicit instruction to avoid `&&`.
*   **Project Map**: Added missing paths for Analyzer, UI Markers, and Document Pipe.

## Files Touched
*   `docs/system.md`
*   `docs/handoff.md`
*   `AGENTS.md`

## Why This Matters
As the codebase evolves from mock to real AI integration, the "Contract" between components (like Handoff) changes. Keeping these docs sharp ensures that future coding sessions don't introduce regressions in context preservation or performance.
