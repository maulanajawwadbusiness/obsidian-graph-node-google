# Step 3 Hardening Run 11: Preview Error UX Upgrade

Date: 2026-02-15
Scope: Improve invalid sample UX without expanding behavior scope.

## File updated

- `src/components/SampleGraphPreview.tsx`

## UX changes

1. Error title
- `sample graph invalid`

2. Error detail list
- shows first 3 validation errors
- each line includes `[CODE] message`

3. Overflow indicator
- shows `+N more` when there are more than 3 errors

## Constraints preserved

- Runtime still does not mount when errors exist.
- Lease-denied path stays unchanged.
- UI remains compact and inside preview bounds.