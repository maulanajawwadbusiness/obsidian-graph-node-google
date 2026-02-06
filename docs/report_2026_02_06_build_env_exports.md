# Build Fix Report (Env Exports)
**Date**: 2026-02-06
**Agent**: Codex
**Scope**: Onboarding env export mismatch

## Summary
Added missing exports in `src/config/env.ts` so onboarding screens can import splash and manifesto durations without TS2305 errors.

## Changes
- Exported `ONBOARDING_SPLASH_MS` and `ONBOARDING_MANIFESTO_MS` with safe defaults.

## Files Touched
- src/config/env.ts
- docs/report_2026_02_06_build_env_exports.md

## Manual Verification Notes
- Run `npm run build` and confirm no TS2305 errors from `config/env`.
