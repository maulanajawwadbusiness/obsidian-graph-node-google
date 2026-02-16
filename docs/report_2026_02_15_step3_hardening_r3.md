# Step 3 Hardening Run 3: Result Flow + Fail-Closed Preview Mount

Date: 2026-02-15
Scope: Add Result/Error helpers and wire preview sample pipeline to explicit fail path.

## Files added

1. `src/lib/validation/result.ts`
- `Result<T>`
- `ok(...)`, `err(...)`, `mapResult(...)`, `chainResult(...)`

2. `src/lib/validation/errors.ts`
- `ValidationError`
- preview error code constants
- `createValidationError(...)`

## File updated

- `src/components/SampleGraphPreview.tsx`

## Control-flow change

Old flow:
- parse dev export (null check)
- adapter in try/catch
- parseSavedInterfaceRecord
- one string error reason

New flow (Result-based):
1. `parseDevInterfaceExportV1(...)` -> `Result` fail if invalid
2. adapter call -> `Result` fail with code if throw
3. `parseSavedInterfaceRecord(...)` -> `Result` fail if null
4. runtime mount allowed only when `sampleLoadResult.ok`

## Fail-closed behavior

- On any sample validation failure, preview renders explicit invalid payload message with error code.
- `GraphPhysicsPlayground` is not mounted when Result fails.
- Existing lease-denied behavior remains unchanged.

## Notes

- Semantic validator is not added in this run yet (planned in later runs).
- Adapter behavior itself (including silent topology coercion) is not changed in this run yet.