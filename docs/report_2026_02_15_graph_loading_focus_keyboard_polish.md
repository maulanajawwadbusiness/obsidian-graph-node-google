# Graph Loading Focus and Keyboard Polish (2026-02-15)

## Scope
- Added focus ownership and keyboard capture polish for `graph_loading`.
- Kept visuals, gate phases, entry intent, watchdog, and analysis internals unchanged.

## Files Touched
- `src/screens/AppShell.tsx`
- `src/screens/appshell/render/GraphLoadingGate.tsx`
- `src/screens/appshell/render/renderScreenContent.tsx`

## Focus Ownership Rules
1. Graph loading gate root is explicitly focusable (`tabIndex=-1`).
2. On entering `graph_loading`, AppShell focuses gate root on next frame when no blocking modal is open.
3. When Confirm becomes visible and enabled, Confirm button is focused via effect.
4. On Confirm transition to `graph`, focus is cleared from gate descendants by blurring the active element.

## Keyboard Bindings
Primary owner: `GraphLoadingGate` root `onKeyDownCapture`.
- `Escape`: trigger back-to-prompt.
- `Enter` and `Space`:
  - if confirm enabled: trigger confirm
  - otherwise no-op.
- handled keys call `preventDefault` and `stopPropagation`.

Fallback owner: AppShell window capture listener while `screen==='graph_loading'`.
- Active only with capture phase (`addEventListener(..., true)`).
- If focus is outside gate root, enforces same Esc/Enter/Space behavior.
- Prevents key leaks to canvas/sidebar even if focus escapes.

## Leak Prevention
- capture-phase keyboard handling at gate + window fallback
- sidebar frozen policy remains active (inert + shield)
- pointer/wheel shielding remains in gate and frozen sidebar

## DEV Guardrails
- Warn if active element is inside sidebar during `graph_loading`.
- Warn if active element is outside gate during `graph_loading` with no blocking modal.

## Manual Verification
1. Prompt -> `graph_loading`: focus lands on gate root.
2. Esc always returns to prompt.
3. Before done, Enter/Space do nothing.
4. When done, Confirm appears and receives focus.
5. Enter/Space confirms and transitions to graph.
6. During `graph_loading`, keypresses do not trigger canvas/sidebar actions.
7. Warm-mount debug path remains stable (`?debugWarmMount=1`).

## Build Verification
- `npm run build` passed after each run.
