# Report 2026-02-08: EnterPrompt Login Overlay Dev Cleanup

## Scope
Cleanup onboarding login overlay UX for dev work:
- Hide noisy login status/debug text in dev by default.
- Make Continue button permanently disabled and non-interactable.
- Set login overlay card background to `#06060A`.
- Set disabled Continue button background to `#06060A`.

## Root Cause
The red noisy text under Google sign-in came from `GoogleLoginButton` local `status` state, rendered unconditionally when non-empty.

Code path:
- `src/components/GoogleLoginButton.tsx`
- `status` state updates on API/login events.
- Render block: `{status ? <div>...</div> : null}`.

In dev, backend/proxy mismatch can produce HTML snippets (e.g. `<!doctype html> ... @vite/client ...`) which polluted onboarding UI.

## Changes Applied

### 1) Dev-mode status visibility gate
File: `src/components/GoogleLoginButton.tsx`

Added:
- `SHOW_LOGIN_DEBUG_ERRORS = import.meta.env.VITE_SHOW_LOGIN_DEBUG_ERRORS === "1" || !import.meta.env.DEV`

Render behavior:
- Status text now renders only when `SHOW_LOGIN_DEBUG_ERRORS && status`.

Result:
- Dev default: hidden.
- Prod default: shown.
- Dev override: set `VITE_SHOW_LOGIN_DEBUG_ERRORS=1` to show.

### 2) Continue button fully disabled
File: `src/auth/LoginOverlay.tsx`

Updated Continue button:
- `disabled` is always true.
- `aria-disabled={true}`
- `tabIndex={-1}`
- retains label and location for formal UI presence.

Disabled interaction styles:
- `pointerEvents: 'none'`
- muted text and opacity
- default cursor

Result:
- no pointer activation
- no keyboard activation
- visually dimmed

### 3) Login overlay visuals to exact #06060A
File: `src/auth/LoginOverlay.tsx`

Applied:
- `CARD_STYLE.background = '#06060A'`
- `PRIMARY_BUTTON_STYLE.background = '#06060A'`

Border/radius/spacing structure was kept as-is.

## Verification

### Build check
- Ran `npm run build`
- Result: success

### Manual acceptance checklist
1. Dev mode, open EnterPrompt login overlay.
2. Confirm no noisy status text appears under Google sign-in by default.
3. Confirm Continue is dim and cannot be clicked/focused/activated.
4. Confirm card background is `#06060A`.
5. Confirm Continue background is `#06060A` while still disabled-looking.
6. Confirm successful sign-in still proceeds via auth state as before.

## Notes
- This patch intentionally hides only Google login status/debug text in dev by default.
- `useAuth().error` rendering in overlay remains unchanged in this patch.
