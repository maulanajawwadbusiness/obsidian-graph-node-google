# Step 3 Hardening Run 9: Semantic Validator Integrated into Preview Pipeline

Date: 2026-02-15
Scope: Block runtime mount when semantically invalid payload passes structural gates.

## File updated

- `src/components/SampleGraphPreview.tsx`

## Pipeline change

Previous preview path:
- strict dev export parse
- strict adapter
- preview saved-record parse wrapper

New preview path:
1. strict dev export parse
2. strict adapter
3. preview saved-record parse wrapper
4. semantic validator `validateSampleGraphSemantic(...)`
5. mount runtime only if all stages return `ok`

## Failure behavior

- Semantic errors now produce explicit invalid state.
- `GraphPhysicsPlayground` is not mounted when semantic validation fails.
- Existing lease denial behavior remains unchanged.