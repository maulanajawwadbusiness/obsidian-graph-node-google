# Sidebar Disable Loading Run 2 (2026-02-16)

## Scope
- Harden AppShell lock observability and guard diagnostics.
- Keep lock behavior unchanged.

## Files
- `src/screens/AppShell.tsx`

## Changes
1. Added DEV lock transition telemetry:
   - `[SidebarLock] prev=<...> next=<...> screen=<...> loading=<0|1>`
2. Upgraded freeze invariant warning to include lock reason context:
   - `[SidebarFreezeGuard] ... reason=<...>`
3. AppShell now tracks lock reason transitions via canonical `SidebarLockReason`.

## Result
- Lock behavior is now traceable and audit-friendly.
- Future policy edits can be verified quickly by reason transition logs.
