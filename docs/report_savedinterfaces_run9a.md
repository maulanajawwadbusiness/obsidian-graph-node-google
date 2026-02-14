# Run 9a Report: Saved Interfaces Routes Module Add

Date: 2026-02-14
Scope: module add only, no monolith wiring changes

## Added
- `src/server/src/routes/savedInterfacesRoutes.ts`
- Exported:
  - `SavedInterfacesRouteDeps`
  - `registerSavedInterfacesRoutes(app, deps)`

## Route Surface Moved Into Module
- `GET /api/saved-interfaces`
- `POST /api/saved-interfaces/upsert`
- `POST /api/saved-interfaces/delete`

## Parity Notes
- Preserved `requireAuth` usage and `res.locals.user.id` access.
- Preserved list query and response mapping, including ISO/null date conversion.
- Preserved exact upsert validation branches and exact error strings.
- Preserved exact 413 message: `saved interface payload too large`.
- Preserved delete validation and `deleted` derivation from `rowCount`.
- Preserved saved-interfaces log strings.

## Helper Move
- Moved `toIsoString()` into this module with identical semantics.
- Monolith cleanup is deferred to run9b.

## Non-Changes
- No monolith route wiring changed yet.
- No parser order or middleware order changes.
