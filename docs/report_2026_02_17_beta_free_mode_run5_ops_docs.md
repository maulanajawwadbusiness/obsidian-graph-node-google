# Run 5 Report: Ops Docs and Rollback for Beta Free Mode
Date: 2026-02-17
Run scope: Document env-toggle operations and rollback.

## Changes made
- Updated `docs/system.md` with a new section:
  - `Beta Free Mode Toggle (Ops)`
- Added explicit operator guidance for:
  - backend env `BETA_FREE_MODE`
  - frontend env `VITE_BETA_FREE_MODE` (optional)
  - enable steps (set env + redeploy)
  - rollback steps (unset/0 + redeploy)
  - expected runtime behavior in both states

## Documentation decisions
- Backend is documented as source of truth for access control.
- Frontend toggle is documented as optional UI preflight behavior only.
- Re-enable payment is env-only, no code edits required.

## Verification
- Commands run:
  - Root: `npm run build`
  - `src/server`: `npm run build`
- Result: pass.
