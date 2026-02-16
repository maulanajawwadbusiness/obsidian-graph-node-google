# Sidebar Disable Loading Run 1 (2026-02-16)

## Scope
- Extract a standalone sidebar lock policy seam.
- Keep current product behavior unchanged.

## Files
- `src/screens/appshell/sidebar/sidebarLockPolicy.ts` (new)
- `src/screens/AppShell.tsx`

## Changes
1. Added lock policy contract:
   - `SidebarLockReason`
   - `SidebarLockState`
   - `computeSidebarLockState(...)`
2. Encoded current policy precedence:
   - screen frozen lock
   - graph-class loading lock
   - prompt login overlay lock
   - unlocked
3. AppShell now derives `sidebarDisabled` and `frozen` from policy output.
4. Added root debug marker:
   - `data-sidebar-lock-reason`

## Result
- Sidebar lock semantics now have one typed source of truth.
- No intended runtime behavior change in this run.
