# Sidebar Disable Loading Run 4 (2026-02-16)

## Scope
- Harden Sidebar UI lock semantics and focus safety.

## Files
- `src/screens/appshell/sidebar/SidebarLayer.tsx`
- `src/components/Sidebar.tsx`
- `src/screens/AppShell.tsx`

## Changes
1. Sidebar lock reason now propagates to UI layer:
   - AppShell -> SidebarLayer -> Sidebar
2. Sidebar root now carries:
   - `data-sidebar-lock-reason=<reason>`
3. Added disabled-focus safety:
   - when disabled lock activates, blur active element if focus is inside sidebar
4. Existing frozen shield and inert behavior remain unchanged.

## Result
- Sidebar lock reason is inspectable at component boundary.
- Focus does not remain trapped in a sidebar control after disabled lock activation.
