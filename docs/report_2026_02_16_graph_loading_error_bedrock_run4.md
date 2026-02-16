# Graph Loading Error Bedrock Run 4 (2026-02-16)

## Scope
- Add prompt-side error handoff UX after gate force-back.
- Keep error feedback explicit and non-blocking.

## Files
- `src/screens/AppShell.tsx`
- `src/screens/appshell/render/renderScreenContent.tsx`
- `src/screens/EnterPrompt.tsx`
- `src/components/PromptCard.tsx`

## What Changed
1. AppShell now stores prompt handoff error message state.
2. On gate `error` force-back action, AppShell sets prompt error message before routing to prompt.
3. Prompt render path receives:
   - `analysisErrorMessage`
   - `onDismissAnalysisError`
4. `PromptCard` now supports an inline dismissible status banner:
   - shown above input
   - non-blocking
   - pointer-down propagation stopped on wrapper and dismiss button
5. Prompt error banner is cleared on:
   - dismiss action
   - new text submit
   - new file submit
   - prompt skip

## UX Result
- Users no longer get silent bounce-back after gate errors.
- Prompt retry path is clear and immediate.
