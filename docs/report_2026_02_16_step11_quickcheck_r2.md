# Step 11 Quickcheck Run 2 - BoxedUiPolicy Hardening

Date: 2026-02-16
Scope: `src/runtime/ui/boxedUiPolicy.ts`

## Changes
1. Expanded boxed debug counters:
   - added `boxedBodyPortalRedirectCount`.
2. Added dev-only invariant helper:
   - `assertBoxedPortalTarget(portalTarget, debugName)`.
   - warns once when portal target is missing.
   - reuses body-portal assertion path when target is body.
3. Hardened `resolveBoxedPortalTarget(...)`:
   - now accepts `HTMLElement | null | undefined`.
   - boxed path with missing target returns `null` safely and warns once (dev-only).
   - body target still blocked; if preview portal root exists, redirects and increments `boxedBodyPortalRedirectCount`.
   - if preview portal root missing, returns `null` and warns once (dev-only).
4. Snapshot now includes:
   - `boxedBodyPortalAttempts`
   - `boxedBodyPortalRedirectCount`
   - `boxedSurfaceDisabledCount`

## Why this tightens Step 11
1. Prevents fragile future callsites from crashing or silently falling back when portal target is absent.
2. Distinguishes blocked body attempts from successful safe redirects for sharper diagnostics.
3. Keeps current runtime behavior unchanged in app mode.

## Verification
- Command: `npm run build`
- Result: pass.
