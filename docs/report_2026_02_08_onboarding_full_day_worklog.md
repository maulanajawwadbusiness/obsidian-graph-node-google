# Report 2026-02-08: Onboarding and Login Overlay Full-Day Worklog

## Summary
This report records the full set of onboarding and login overlay fixes completed during this session.
The work focused on three themes:
1. Input ownership and fullscreen safety in onboarding.
2. Removal of random background-triggered fullscreen behavior.
3. EnterPrompt login overlay cleanup for dev UX and visual consistency.

## Workstream A: Forensic Baseline and System Mapping

### A1) Onboarding and i18n forensic mapping
- Read and traced:
  - `docs/system.md`
  - `docs/repo_xray.md`
  - `docs/report_2026_02_08_welcome1_redesign.md`
- Performed code-level forensic scan of:
  - `src/screens/AppShell.tsx`
  - `src/screens/Welcome1.tsx`
  - `src/screens/Welcome2.tsx`
  - `src/screens/EnterPrompt.tsx`
  - `src/auth/LoginOverlay.tsx`
  - `src/components/PromptCard.tsx`
  - `src/i18n/*`

### A2) Forensic output
- Added report:
  - `docs/forensic_report_2026_02_08_onboarding_i18n.md`
- Key finding:
  - onboarding text and i18n ownership were fragmented across multiple patterns.

## Workstream B: Overlay Must Block Fullscreen Button Input

### B1) Root cause
- Fullscreen icon in AppShell had higher z-index than onboarding overlays.
- Overlays did not always sit in a guaranteed top layer.

### B2) Fix implementation
- `src/components/FullscreenButton.tsx`
  - Added `blocked?: boolean` guard.
  - Disabled pointer input when blocked.
- `src/screens/AppShell.tsx`
  - Tracked overlay-open state (`welcome1` and `enterprompt`).
  - Passed `blocked` to `FullscreenButton`.
  - Lowered fullscreen button chrome z-index.
- `src/screens/Welcome1.tsx`
  - Reported overlay state to AppShell.
  - Hardened prompt backdrop to fixed full-viewport top layer.
- `src/screens/EnterPrompt.tsx`
  - Reported login overlay open/close state.
- `src/auth/LoginOverlay.tsx`
  - Raised backdrop z-index to top-layer tier.

### B3) Documentation
- Added:
  - `docs/report_2026_02_08_onboarding_overlay_fullscreen_block.md`

## Workstream C: Remove Random Fullscreen on Generic Onboarding Click

### C1) Root cause
- A global first-gesture hook in `AppShell` called `requestFullscreen()` from generic pointer/keyboard interaction.

### C2) Fix implementation
- Removed global first-gesture fullscreen trigger from `src/screens/AppShell.tsx`.
- Kept fullscreen entry only through explicit controls.
- Added explicit-only marker comment at fullscreen request callsite in `src/hooks/useFullscreen.ts`.

### C3) Documentation
- Added:
  - `docs/report_2026_02_08_onboarding_remove_random_fullscreen.md`

## Workstream D: EnterPrompt Login Overlay Dev Cleanup

### D1) Dev error text spam suppression
- `src/components/GoogleLoginButton.tsx`
  - Added env-gated visibility:
    - `VITE_SHOW_LOGIN_DEBUG_ERRORS=1` or non-dev to show.
    - Hidden by default in dev.

### D2) Continue button behavior and visual tuning
- Updated `src/auth/LoginOverlay.tsx` multiple times based on live UX feedback:
  - Card background set to `#06060A`.
  - Continue button background set to `#06060A`.
  - Continue button logic changed to no-op surface:
    - no click handler.
    - `aria-disabled=true`.
    - `tabIndex=-1`.
  - Hover cursor set to hand (`pointer`) per request.
  - Pointer events enabled on Continue (visual affordance only, no action).

### D3) Secondary auth error channel fix
- Identified additional red error source from `useAuth().error` in LoginOverlay.
- Added same env-gated dev suppression in `src/auth/LoginOverlay.tsx`.

### D4) Documentation
- Added:
  - `docs/report_2026_02_08_enterprompt_login_overlay_dev_cleanup.md`
  - `docs/report_2026_02_08_login_overlay_error_gate_followup.md`

## Commits Created in This Session

1. `b2a2f0f` - `fix(onboarding): block fullscreen input when overlays are open`
2. `f4472f2` - `chore: add pending untracked files`
3. `36c995d` - `fix(onboarding): remove background-triggered fullscreen path`
4. `a89088c` - `fix(onboarding): clean login overlay dev errors and disable continue`
5. `c591fdb` - `fix(onboarding): gate LoginOverlay auth errors in dev`
6. `572162f` - `fix(onboarding): adjust continue button interaction styling`

## Verification Performed

- Repeated `npm run build` verification after major changes.
- Build passed after each major patch batch.
- Static search verification for fullscreen callsites and auth error render paths was performed.

## Current Behavior Snapshot (End of Session)

- Onboarding fullscreen no longer triggers from background click/keydown.
- Fullscreen button is blocked when onboarding overlays are open.
- Login overlay card background is `#06060A`.
- Continue button is present but non-functional (no click handler), visually active-style with pointer cursor.
- Login debug/error text is hidden by default in dev and can be shown with `VITE_SHOW_LOGIN_DEBUG_ERRORS=1`.

## Notes

- Manual browser-level interaction checks are still required for final visual confirmation in local runtime.
- This report does not include unrelated local modifications outside onboarding/login scope.
