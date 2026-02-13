# Backend Modularization Map (Run 4)

## Summary
This run starts decomposing backend wiring by moving feedback route logic and admin allowlist parsing into dedicated modules, while preserving the existing single Express app startup path.

## New modules
- `src/server/src/lib/adminAllowlist.ts`
  - `readAdminAllowlistRaw(env)`
  - `parseAdminAllowlist(raw)`
  - `isAdminEmail(allowlist, email)`
- `src/server/src/routes/feedbackRoutes.ts`
  - `registerFeedbackRoutes(app, deps)`
  - Registers:
    - `POST /api/feedback`
    - `GET /api/feedback`
    - `POST /api/feedback/update-status`

## Current wiring
- Entrypoint remains `src/server/src/index.ts`.
- Runtime app creation and listen remain in `src/server/src/serverMonolith.ts`.
- `serverMonolith.ts` now imports and uses:
  - `registerFeedbackRoutes(...)`
  - admin allowlist helpers from `lib/adminAllowlist.ts`

## Verification snapshot
- `npm run build` passes.
- `curl -i http://localhost:8080/health` returns `200`.
- `curl -i -X POST http://localhost:8080/api/feedback ...` returns `401` without cookie.

## Next modularization cuts
- Move auth routes (`/auth/google`, `/me`, `/auth/logout`) to `routes/authRoutes.ts`.
- Move profile routes to `routes/profileRoutes.ts`.
- Move saved-interface routes to `routes/savedInterfacesRoutes.ts` while preserving payload limits and current validation behavior.
- Continue splitting large LLM/payment route blocks so each file can be kept below target size.
