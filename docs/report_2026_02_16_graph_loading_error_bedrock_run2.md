# Graph Loading Error Bedrock Run 2 (2026-02-16)

## Scope
- Decouple runtime loading truth from runtime error truth.
- Preserve backward compatibility for existing loading callback consumers.

## Files
- `src/playground/GraphPhysicsPlaygroundShell.tsx`

## What Changed
1. Added runtime status contract:
   - `GraphRuntimeStatusSnapshot`
   - `onRuntimeStatusChange?: (status) => void`
2. Updated loading derivation:
   - from `aiActivity || Boolean(aiErrorMessage)`
   - to `aiActivity` only
3. Preserved compatibility:
   - `onLoadingStateChange?.(isGraphLoading)` still emits loading-only boolean
4. Added DEV diagnostics:
   - `[GraphLoadingContract] loading=<0|1> error=<present|none>`

## Contract Notes
- Error state is now reported independently via `onRuntimeStatusChange`.
- Legacy loading fallback return path still exists but now only activates on true loading.
- This run intentionally does not change AppShell gate policy yet.
