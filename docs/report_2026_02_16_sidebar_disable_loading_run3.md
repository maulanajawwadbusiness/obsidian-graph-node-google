# Sidebar Disable Loading Run 3 (2026-02-16)

## Scope
- Make modal/search lock reactions deterministic.
- Move modal gating from raw boolean to reasoned lock state contract.

## Files
- `src/screens/appshell/overlays/useAppShellModals.ts`
- `src/screens/AppShell.tsx`

## Changes
1. `useAppShellModals` now accepts `sidebarLock` instead of `sidebarDisabled`.
2. Entry-point guards (`openSearchInterfaces`, `openProfileOverlay`, `openLogoutConfirm`) now use `sidebarLock.disabled`.
3. Replaced repeated reactive close with lock-edge close:
   - close search/profile/logout only when lock transitions from unlocked to locked.
4. AppShell now passes full lock state into `useAppShellModals`.

## Result
- Overlay close behavior is deterministic and less jitter-prone under loading.
- Lock semantics are centralized and future-safe for reason-based behavior.
