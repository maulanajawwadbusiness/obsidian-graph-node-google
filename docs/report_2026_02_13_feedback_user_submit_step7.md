# Feedback User Submit UX Step 7

## Scope
- Frontend user submit flow in `src/screens/AppShell.tsx` only.
- Admin inbox UI is out of scope for this step.

## Behavior
- Feedback modal submit is logged-in only.
- Send calls `submitFeedback(...)` from `src/api.ts`.
- While sending:
  - Send and Cancel are disabled.
  - Backdrop click close is blocked.
  - Escape close is blocked.
- On success:
  - Shows short success state (`sent. thanks.`) then closes automatically.
- On failure:
  - Shows a calm generic error and keeps modal open.

## Feedback Context Payload (high level)
- `screen`
- `savedInterfacesCount`
- `clientSubmittedAt`

## Safety Notes
- No feedback message or context payload is logged in frontend.
- Modal/backdrop/textarea/buttons use pointer and wheel shielding so canvas does not react underneath.
