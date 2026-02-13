# Sidebar More Menu Forensic + Implementation Report (2026-02-13)

## Scope
- File: `src/components/Sidebar.tsx`
- Task: add anchored `More` popup menu with two items:
  - Suggestion and Feedback (stub only)
  - Arnvoid Blog (external link)

## Forensic Summary
- `More` row existed as visual nav item only; no click action.
- Search overlay is owned by `AppShell`, not Sidebar.
- Sidebar already had two anchored popup patterns:
  - Row ellipsis menu (Rename/Delete)
  - Avatar menu (Profile/Log Out)
- Both existing popup patterns already use:
  - `position: fixed` popup roots
  - capture-phase outside-close pointer listeners
  - Escape close
  - pointer and wheel stop-propagation shields

## Changes Applied
- Added `More` popup state and placement:
  - `isMoreMenuOpen`, anchor rect, computed position, placement, hover key.
- Added placement helper with clamp and vertical flip behavior.
- Added open/close/toggle callbacks for `More` menu.
- Added StrictMode-safe outside-close and Escape listeners for `More`.
- Added resize + capture scroll reposition updates for `More`.
- Added single-open-menu policy:
  - opening `More` closes row menu and avatar menu
  - opening row or avatar menu closes `More`
- Added `More` trigger wiring:
  - `data-more-trigger="1"` marker
  - hard shielding on pointer/click/wheel via `hardShieldInput`
- Added popup markup:
  - root marker `data-more-menu="1"`
  - Suggestion and Feedback row:
    - closes popup
    - logs `[sidebar] suggestion_feedback_clicked`
    - TODO placeholder for future UI flow
  - Arnvoid Blog row:
    - closes popup
    - opens `https://blog.arnvoid.com` with `window.open(..., "_blank", "noopener,noreferrer")`
- Imported existing assets:
  - `src/assets/suggestion_feedback_icon.png`
  - `src/assets/blog_icon.png`

## Input Shielding Notes
- Sidebar root and all popup roots keep pointer and wheel stop-propagation.
- `More` trigger, popup root, and item buttons all stop pointer and wheel propagation.
- No global `preventDefault` added except existing explicit click handlers where needed.

## Verification
- Manual functional checks expected:
  - `More` toggles open/close on repeated clicks.
  - outside click closes menu.
  - Escape closes menu.
  - popup interaction does not leak to canvas or row selection.
  - Blog opens in new tab.
- Build gate:
  - `npm run build` must pass.
