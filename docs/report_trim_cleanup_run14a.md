# Run 14a Report: Dead Code and Unused Surface Trim

Date: 2026-02-14
Scope: cleanup scan and deletion of truly dead pieces only

## Summary
This run removed only dead or unnecessary exposed surface with no runtime behavior changes and no ordering changes.

## Deletions

1. `src/server/src/server/envConfig.ts`
- Removed unused fields from `ServerEnvConfig` type and return object:
  - `devPorts`
  - `defaultDevOrigins`
  - `defaultAllowedOrigins`
  - `allowedOriginsRaw`

Why safe:
- These fields were not read by runtime code after run13.
- CORS behavior remains unchanged because `corsAllowedOrigins` and `shouldWarnMissingAllowedOriginsInProd` logic are unchanged.
- Internal local variables (`defaultDevOrigins`, `allowedOriginsRaw`) still exist and are used to compute runtime behavior.

2. `src/server/src/auth/googleToken.ts`
- Removed unnecessary `export` modifier from local-only types:
  - `GoogleTokenVerifyArgs`
  - `GoogleTokenInfo`

Why safe:
- These types were not imported by any other module.
- Function behavior of `makeVerifyGoogleIdToken()` is unchanged.

## Explicit Non-Changes
- No route handler logic changed.
- No route registration order changed.
- No parser/cors/startup ordering changed.
- No env default parsing changed.

## Result
Run14a reduced dead public surface and kept runtime behavior identical.
