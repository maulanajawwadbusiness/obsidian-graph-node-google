# Server modularization under 850 lines

## Outcome
- Removed `src/server/src/serverMonolith.ts`.
- `src/server/src/index.ts` is now boot only.
- Route groups are explicitly registered through `createApp()`.
- All backend TypeScript files are at or below 850 lines.

## Final routing layout
- `src/server/src/routes/authRoutes.ts`
  - `POST /auth/google`
  - `GET /me`
  - `POST /auth/logout`
- `src/server/src/routes/profileRoutes.ts`
  - `POST /api/profile/update`
- `src/server/src/routes/savedInterfacesRoutes.ts`
  - `GET /api/saved-interfaces`
  - `POST /api/saved-interfaces/upsert`
  - `POST /api/saved-interfaces/delete`
- `src/server/src/routes/feedbackRoutes.ts`
  - `POST /api/feedback`
  - `GET /api/feedback`
  - `POST /api/feedback/update-status`
- `src/server/src/routes/paymentsRoutes.ts`
  - `POST /api/payments/webhook`
  - `GET /api/rupiah/me`
  - `POST /api/payments/gopayqris/create`
  - `GET /api/payments/:orderId/status`
- `src/server/src/routes/llmAnalyzePrefillRoutes.ts`
  - `POST /api/llm/paper-analyze`
  - `POST /api/llm/prefill`
- `src/server/src/routes/llmChatRoutes.ts`
  - `POST /api/llm/chat`

## App and middleware layout
- `src/server/src/app/createApp.ts`
  - Express app creation
  - body parsers
  - CORS wiring
  - `/health`
  - explicit route registrations
- `src/server/src/app/deps.ts`
  - shared constants and helpers
- `src/server/src/middleware/requireAuth.ts`
  - auth gate middleware

## Line cap proof
Command used:
- `cd src/server && npm run check:line-cap`

Result:
- `[line-cap] ok: all .ts files are <= 850 lines`
