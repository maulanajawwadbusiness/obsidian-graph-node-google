# Report: Onboarding Start Screen Env Wiring Fix
Date: 2026-02-09
Scope: Restore `VITE_ONBOARDING_START_SCREEN` so test startup can begin from all onboarding screens and graph.

## 1. Root Cause
- `src/config/env.ts` only parsed `VITE_ONBOARDING_START_SCREEN=prompt`.
- `src/screens/AppShell.tsx` only honored parsed value when it was `prompt`.
- Result: any non-`prompt` value defaulted to `welcome1`.

## 2. Changes Applied
### A. Env parsing (`src/config/env.ts`)
- Added explicit `OnboardingScreen` type:
  - `welcome1 | welcome2 | prompt | graph`
- Added parser for `VITE_ONBOARDING_START_SCREEN` with normalization (`trim().toLowerCase()`).
- Supported inputs:
  - Canonical: `welcome1`, `welcome2`, `prompt`, `graph`
  - Aliases: `screen1`, `screen2`, `screen3`, `screen4`
- Added `ONBOARDING_START_SCREEN_RAW` export for diagnostics.

### B. Initial screen selection (`src/screens/AppShell.tsx`)
- `getInitialScreen()` now returns any parsed non-null `ONBOARDING_START_SCREEN` in DEV.
- Added one-time DEV warning for invalid non-empty raw env value:
  - Tag: `[OnboardingStart]`
  - Message includes allowed values.
- Default behavior unchanged:
  - onboarding disabled -> `graph`
  - invalid/empty override -> `welcome1`

### C. System doc sync (`docs/system.md`)
- Added onboarding start override contract:
  - accepted canonical and alias values
  - DEV-only scope
  - invalid fallback + warning behavior

## 3. Expected Mapping
- `screen1` or `welcome1` -> `welcome1`
- `screen2` or `welcome2` -> `welcome2`
- `screen3` or `prompt` -> `prompt`
- `screen4` or `graph` -> `graph`
- invalid non-empty value -> `welcome1` plus one DEV warning

## 4. Verification
- Build/type check: `npm run build` passes after changes.
- Manual matrix to run in DEV:
  - `VITE_ONBOARDING_ENABLED=true`
  - verify each value above routes to expected initial screen on reload.
  - verify invalid value logs one warning and starts at `welcome1`.

