# Teardown Reacquire Fix Report (2026-02-16)

## Root Cause
`GraphRuntimeLeaseBoundary` could reacquire during its own unmount teardown.

Sequence:
1. unmount cleanup released active graph token.
2. release notified lease subscribers synchronously.
3. boundary subscriber callback could still run during teardown window.
4. callback reacquired `graph-screen` lease even though graph was unmounting.

This left lease stuck as `graph-screen` after returning to prompt, causing preview to remain paused.

## Fix
File: `src/runtime/GraphRuntimeLeaseBoundary.tsx`

1. Added disposal guard:
- `isDisposingRef` marks teardown state.
- set `isDisposingRef.current = true` before cleanup release path.
- subscriber callback returns immediately when disposing.

2. Kept cleanup safety:
- token ref is nulled before release call.
- lease stale-release handling remains in `graphRuntimeLease.ts`.

3. Tightened subscription timing:
- subscription effect now uses `useLayoutEffect`.

4. Added small DEV-only guardrails:
- bounded warning counter when subscriber fires during dispose.
- warn-once for blocked reacquire attempt during dispose.

## Verification
1. Build:
- `npm run build` passed.

2. Manual flow to verify:
- prompt -> graph -> prompt.
- preview should resume; no stuck `preview paused (active: graph-screen)`.
- check DEV logs:
  - no reacquire during dispose.
  - graph lease not left active after graph unmount.
