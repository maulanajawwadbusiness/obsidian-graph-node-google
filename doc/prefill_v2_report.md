# Prefill System V2: Seed + Async Refine

## Overview
Upgraded the Full Chat "Context Handoff" to be instantaneous and respecting of user intent.

## Changes
1. **New Helper Module**: `src/fullchat/prefillSuggestion.ts`
   - `makeSeedPrompt`: Synchonous, fast string ops for instant feedback.
   - `refinePromptAsync`: Async mock (later LLM) for better prompts.

2. **FullChatStore Updates**:
   - `receiveFromMiniChat` now applies `seed` immediately.
   - Starts an async refine job (managed via `AbortController`).
   - Handles race conditions (jobId matching) and cancellation.

3. **FullChatbar UI Updates**:
   - Tracks `dirtySincePrefill` (did user type?).
   - If user typed: refinement is parked as a `pendingSuggestion` (Apply button).
   - If user didn't type: refinement auto-upgrades the input text.
   - Visual: Added floating "✨ Refined prompt available" badge.

## Verification Checklist (Manual)
- [ ] **Instant Seed**: Clicking "Send to Full Chat" fills input immediately.
- [ ] **Auto-Upgrade**: Waiting without typing -> input changes to refined version.
- [ ] **Dirty State Protection**: Typing immediately after handoff -> refinement does NOT overwrite text.
- [ ] **Pending UI**: If dirty, "Refined prompt available" badge appears.
- [ ] **Cancellation**: Rapid clicking doesn't cause race conditions (logs confirm cancellation).

## Logs
Look for:
- `[Prefill] seed_applied`
- `[Prefill] refine_started`
- `[Prefill] refine_ready`
- `[Prefill] refine_canceled`
