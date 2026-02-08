# Report 2026-02-08: Remove Random Onboarding Fullscreen Trigger

## Scope
Remove the "click anywhere in onboarding can enter fullscreen" behavior across:
- `welcome1`
- `welcome2`
- `enterprompt`

## Root Cause
The trigger lived in `AppShell` via a global first-gesture hook.

Path before fix:
1. `src/screens/AppShell.tsx` called `useFirstUserGesture(...)` while onboarding was active.
2. `src/hooks/useFirstUserGesture.ts` registered capture listeners on `window` for `pointerdown` and `keydown`.
3. First click/keydown anywhere in onboarding executed `document.documentElement.requestFullscreen()`.

This created random fullscreen entry from background clicks.

## Changes Applied

### 1) Removed global onboarding first-gesture fullscreen trigger
File: `src/screens/AppShell.tsx`
- Removed `useFirstUserGesture` import.
- Removed `useFullscreen` import and `isFullscreen` usage for this path.
- Removed debug/keys constants used only by this path.
- Removed the entire `useFirstUserGesture(...)` block that called `requestFullscreen()`.

Result: background click/keydown on onboarding no longer triggers fullscreen.

### 2) Added defensive explicit-only marker at fullscreen entry point
File: `src/hooks/useFullscreen.ts`
- Added comment at `requestFullscreen()` callsite:
  - fullscreen entry is explicit-controls-only.
  - never invoke from generic background/global gesture handlers.

## Fullscreen Entry Points After Fix
`requestFullscreen()` callsites in `src/`:
- `src/hooks/useFullscreen.ts` only.

Meaning:
- Fullscreen can now be entered only via explicit controls that call `useFullscreen().enterFullscreen()` or `toggleFullscreen()`.
- In onboarding, this maps to:
  - Welcome1 consent button (Yes, activate).
  - Top-right fullscreen icon button (when not overlay-blocked).

## Verification

### Static verification
- Search check: `rg -n "requestFullscreen\(" src`
- Result: only one callsite remains (`src/hooks/useFullscreen.ts`).

### Build verification
- Ran: `npm run build`
- Result: success (`tsc` + `vite build` completed).

### Manual verification checklist
1. Enable onboarding.
2. On Welcome1, click background/empty area.
   - Expected: no fullscreen toggle.
3. On Welcome2, click background/empty area.
   - Expected: no fullscreen toggle.
4. On EnterPrompt, click background/empty area.
   - Expected: no fullscreen toggle.
5. Click explicit fullscreen icon (when allowed).
   - Expected: fullscreen toggles.
6. Click Welcome1 "Yes, activate".
   - Expected: fullscreen enters.

## Notes
- `src/hooks/useFirstUserGesture.ts` remains in repo but is no longer used by onboarding.
- This change intentionally keeps fullscreen consent and icon paths intact while eliminating generic interaction side effects.
