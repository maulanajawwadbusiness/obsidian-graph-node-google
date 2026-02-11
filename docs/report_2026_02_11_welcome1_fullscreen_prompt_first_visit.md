# Report 2026-02-11: Welcome1 Fullscreen Prompt First-Visit Gate

## Scope
Implement first-visit-only behavior for the Welcome1 fullscreen consent prompt.

Target behavior:
- Show fullscreen prompt only for first-time visitors on this browser profile.
- Persist seen state in localStorage.
- Mark prompt as seen only after explicit user choice (Yes or No).

## Root Cause
Welcome1 initialized fullscreen prompt state only from:
- `SHOW_WELCOME1_FULLSCREEN_PROMPT`
- `!isFullscreen`

Result: prompt reopened on every visit when onboarding starts at `welcome1`.

## Changes Applied

### 1) Added localStorage seen flag helpers
File: `src/screens/Welcome1.tsx`

Added:
- `WELCOME1_FULLSCREEN_PROMPT_SEEN_KEY = "arnvoid_welcome1_fullscreen_prompt_seen_v1"`
- `canUseBrowserStorage()`
- `hasSeenWelcome1FullscreenPrompt()`
- `markWelcome1FullscreenPromptSeen()`

Safety:
- Browser guards for SSR/non-browser contexts.
- try/catch around localStorage get/set to avoid runtime crashes.

### 2) Prompt open state now checks first-visit condition
File: `src/screens/Welcome1.tsx`

Added memoized initial gate:
- `shouldShowFullscreenPrompt = SHOW_WELCOME1_FULLSCREEN_PROMPT && !isFullscreen && !hasSeen...`

State initialization now uses this gate:
- `isFullscreenPromptOpen` starts true only for first-visit users.
- `hasFullscreenDecision` starts true when prompt should not be shown, so splash timer proceeds without modal.

### 3) Seen flag write moved to explicit button choice
File: `src/screens/Welcome1.tsx`

Behavior:
- `handleActivateFullscreen()` writes seen flag before fullscreen attempt.
- `handleStayWindowed()` writes seen flag before closing prompt.

This matches product requirement:
- Refresh before clicking keeps prompt eligible.
- Once user chooses either button, prompt never shows again on this device.

## Verification Checklist (Manual)
1. New browser profile or cleared key:
   - Open app on onboarding Welcome1.
   - Prompt should show.
2. Click "No, stay in this screen":
   - Prompt closes and onboarding continues.
   - Reload app; prompt should not show.
3. Clear key again and repeat with "Yes, activate":
   - Prompt closes after explicit choice.
   - Reload app; prompt should not show.
4. Refresh before any button click:
   - Prompt should still show (seen not written yet).
5. Disable flag (`SHOW_WELCOME1_FULLSCREEN_PROMPT = false`):
   - Prompt never renders.

## Notes
- Change is localized to Welcome1 and does not alter AppShell onboarding routing.
- Overlay shielding and fullscreen blocking contracts remain unchanged.
