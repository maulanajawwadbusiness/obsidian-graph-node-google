# Run 13b Report: Monolith Helper Blade Extraction

Date: 2026-02-14
Scope: extract non-shell helper logic from `serverMonolith.ts` into dedicated modules

## Summary
This run extracts real logic helpers out of monolith while keeping route behavior and registration order unchanged.

## New Modules

1. `src/server/src/auth/googleToken.ts`
- added `makeVerifyGoogleIdToken()`
- encapsulates Google OAuth2Client verification logic
- keeps current auth route contract compatibility:
  - returned verifier accepts `{ idToken, audience }`

2. `src/server/src/payments/midtransUtils.ts`
- moved helper functions from monolith:
  - `parseGrossAmount`
  - `sanitizeActions`
  - `isPaidStatus`
  - `verifyMidtransSignature`

3. `src/server/src/auth/requireAuth.ts`
- added `makeRequireAuth(...)`
- encapsulates session-cookie auth middleware logic
- preserves behavior:
  - missing session cookie: `401 { ok:false, error:"unauthorized" }`
  - invalid session row: clear cookie + `401 { ok:false, error:"invalid session" }`
  - db failure: `500 { ok:false, error:"db error: ..." }`
  - success: assigns `res.locals.user`

## Monolith Changes
- `src/server/src/serverMonolith.ts`
  - removed direct imports for OAuth2Client and crypto logic helpers
  - removed inline helper implementations extracted above
  - now composes:
    - `verifyGoogleIdToken` via `makeVerifyGoogleIdToken()`
    - `requireAuth` via `makeRequireAuth(...)`
    - payments helper functions via imports from `midtransUtils`
  - route deps builder services bag now receives extracted helpers

## Parity Proof Notes
1. No route handler logic changed in route modules.
2. No route registration order changed.
3. No startup ordering changed.
4. Cookie/session semantics in auth middleware preserved.
5. Midtrans signature and helper behavior preserved byte-for-byte in logic.

## Result
Monolith now carries less business logic and is closer to wiring-only orchestration, preparing run13c bootstrap extraction safely.
