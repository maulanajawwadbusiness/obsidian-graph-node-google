# Run 3 Report: Preview Runtime Lease Wiring

Date: 2026-02-15
Scope: Step 4 run 3 only (SampleGraphPreview lease guard)

## Files changed

- `src/components/SampleGraphPreview.tsx`

## What was added

1. Lease integration in preview:
   - imports from `src/runtime/graphRuntimeLease.ts`
   - owner: `prompt-preview`
2. Stable preview instance id:
   - generated once via `useRef(...)`
3. Lease state machine in preview component:
   - `checking`
   - `allowed` with token
   - `denied` with active owner info
4. Lifecycle handling:
   - acquire on mount (`useLayoutEffect`)
   - release on unmount when token exists

## Behavioral result

- If preview lease is denied, preview runtime is not mounted.
- Fallback text is shown: `preview paused (active: <owner>)`.
- When lease is allowed, existing preview runtime path is unchanged:
  - same `PortalScopeProvider`
  - same `TooltipProvider`
  - same `GraphPhysicsPlayground` props

## Safety notes

- Denied path performs zero graph runtime mount side effects.
- Existing sample payload parse/adapter pipeline is untouched.
- Existing portal containment behavior is untouched.