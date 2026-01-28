# Prefill System V3: Smooth Streaming

## Overview
Replaced the "jarring" instantaneous text fill with a gentle 60fps streaming effect. Removed the "sticker" badge entirely.

## Changes
1.  **Removed "Sticky" UI**:
    -   Deleted `pendingSuggestion` from Store and UI.
    -   Removed the "✨ Refined prompt available" badge.
    -   Rule: If user types, we silently discard the refinement. No nagging.

2.  **Smooth Streaming**:
    -   **Seed**: Streams in quickly (~180 chars/sec) instead of appearing instantly.
    -   **Refine**: When the AI refinement arrives, it *continues* streaming from the current text state.
    -   **Algorithm**: Local `requestAnimationFrame` loop in `FullChatbar`. No heavy store updates per character.

3.  **Seed Text Simplified**:
    -   Changed to: `In context of "${nodeLabel}", continuing...` (removed preview text).

## Performance
-   Uses `requestAnimationFrame` for 60fps updates.
-   Updates DOM `value` directly for smoothness, syncs React state occasionally/on-finish.
-   Cancels immediately on user interaction (typing stops stream).

## Verification Checklist (Manual)
-   [ ] **Handoff**: Click "Send to Full Chat" -> text streams in ("In context...").
-   [ ] **Refinement**: Wait ~300ms -> text smoothly morphs/extends to the refined prompt.
-   [ ] **Interruption**: Type immediately after handoff -> streaming stops -> no badge appears -> no text replacement.
-   [ ] **Visuals**: No "brick" effect. No floating badges.

## Logs
-   `[Prefill] stream_start mode=seed|refine`
-   `[Prefill] stream_stop reason=done|dirty`
-   `[Prefill] refine_ready apply=YES|NO`
