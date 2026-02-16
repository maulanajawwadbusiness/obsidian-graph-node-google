# Gate Error Visibility Run 3 (2026-02-16)

## Scope
- Wire normalized gate error message across gate surface and prompt handoff.
- Prevent stale prompt error carryover on new graph-loading entry.

## Files
- `src/screens/AppShell.tsx`

## Changes
1. Added shared normalized gate error message derivation:
   - trims runtime message
   - falls back to `Analysis failed. Please try again.` when empty/missing
2. Gate UI now receives normalized message for `error` rendering.
3. Explicit Back from error gate now hands off normalized message to prompt banner.
4. Entering a new `graph_loading` cycle clears old prompt banner state and stale runtime error snapshot.

## Result
- Error text is consistent between gate and prompt.
- Retry path no longer shows stale previous-cycle error.
