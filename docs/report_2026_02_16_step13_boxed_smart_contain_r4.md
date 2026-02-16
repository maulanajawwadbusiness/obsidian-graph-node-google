# Step 13 Boxed Smart Contain Run 4 - Reset + Edge Hardening

Date: 2026-02-16

## Hardening updates

File: `src/playground/GraphPhysicsPlaygroundShell.tsx`

1. One-shot reset by interface identity:
   - added `lastSmartContainInterfaceIdRef`.
   - active id = `pendingLoadInterface?.id ?? null`.
   - when id changes:
     - reset `didSmartContainRef=false`
     - reset warn flag
   - result: smart contain runs again for new loaded interface, not for resize churn.

2. Edge warn-once for missing bounds:
   - added `warnedSmartContainNoBoundsRef`.
   - if smart contain attempts and bounds are empty/invalid, emit dev warn-once with interface id + node count.

3. Counter behavior:
   - on missing/invalid bounds, `recordBoxedSmartContainSkippedNoBounds()` increments.

4. No behavior regression to resize semantics:
   - Step 12 boxed resize-preserve-center path remains unchanged.
   - no per-frame refit loop introduced.

## Verification
- Command: `npm run build`
- Result: pass.
