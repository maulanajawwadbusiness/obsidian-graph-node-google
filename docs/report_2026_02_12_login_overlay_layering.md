# Report 2026-02-12: Login Overlay Layering Hardening

## Scope
- Prevent any Sidebar surface from rendering above the login box overlay.
- Remove dependence on parent stacking contexts for login overlay ordering.
- Keep pointer ownership strict when login overlay is open.

## Root Cause
- `LoginOverlay` was rendered inline under `EnterPrompt`.
- In `AppShell`, non-sidebar content can receive `filter: brightness(0.8)` when sidebar is expanded.
- CSS `filter` creates a new stacking context.
- Sidebar is mounted as a sibling tree and row menu popup uses `position: fixed` with a high z-index.
- Result: login overlay z-index was local to its stacking context and could still appear below sidebar surfaces.

## Changes
1. Added shared layer tokens:
   - `src/ui/layers.ts`
2. Portalized login overlay:
   - `src/auth/LoginOverlay.tsx`
   - Render now uses `createPortal(..., document.body)`.
   - Login overlay z-index now uses `LAYER_OVERLAY_LOGIN`.
3. Unified sidebar layering with tokens:
   - `src/components/Sidebar.tsx`
   - Sidebar root uses `LAYER_SIDEBAR`.
   - Sidebar row menu popup uses `LAYER_SIDEBAR_ROW_MENU`.
4. Unified AppShell modal layering with tokens:
   - `src/screens/AppShell.tsx`
   - Search overlay uses `LAYER_MODAL_SEARCH`.
   - Delete modal uses `LAYER_MODAL_DELETE`.
   - Onboarding fullscreen button uses `LAYER_ONBOARDING_FULLSCREEN_BUTTON`.
5. Input ownership hardening while login overlay is open:
   - `src/screens/AppShell.tsx`
   - Sidebar is now disabled when prompt login overlay is open.

## Layer Contract (Current)
- `LAYER_SIDEBAR = 50`
- `LAYER_ONBOARDING_FULLSCREEN_BUTTON = 1200`
- `LAYER_SIDEBAR_ROW_MENU = 1400`
- `LAYER_MODAL_SEARCH = 3100`
- `LAYER_MODAL_DELETE = 3200`
- `LAYER_OVERLAY_LOGIN = 5000`

## Manual Verification Checklist
1. Prompt screen, logged out, sidebar collapsed:
   - Login overlay is on top of sidebar.
2. Prompt screen, logged out, sidebar expanded:
   - Login overlay is still topmost.
3. Open sidebar row menu, then trigger login overlay:
   - Row menu is not visible above login overlay.
4. Wheel and pointer inside sidebar while login overlay open:
   - Sidebar does not consume input.
5. Search or delete modals do not regress:
   - Their ordering remains stable with sidebar.

## Notes
- This fix removes stacking-context fragility by moving login overlay to the document body layer.
- Future overlays should use `src/ui/layers.ts` instead of hardcoded z-index values.
