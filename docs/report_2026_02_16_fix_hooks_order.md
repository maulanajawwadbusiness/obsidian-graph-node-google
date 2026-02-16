# Hook Order Fix Report (2026-02-16)

## Root Cause
`AppShell` had an early return for welcome1 font gate before a later hook call.

- Early return: `if (screen === 'welcome1' && !welcome1FontGateDone) return ...`
- Later hook: `const renderScreenContentByScreen = React.useCallback(...)`

This made hook count differ between renders and triggered:
`Rendered more hooks than during the previous render`.

## Fix
Moved the welcome1 early return to run after `renderScreenContentByScreen` is declared.

Result:
- all hooks in `AppShell` are now called unconditionally in stable order on every render.
- runtime bridge stabilization from `3c26696` stays intact:
  - stable handlers
  - no-op guarded runtime status/loading writes

## Verification
1. Build check:
- `npm run build`

2. Manual checks to run in browser:
- hard refresh app on welcome1; confirm screen is not blank and no hook-order error.
- navigate to graph screen; confirm drag and physics remain active.
