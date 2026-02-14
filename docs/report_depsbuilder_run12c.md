# Run 12c Report: Monolith Wired Through depsBuilder

Date: 2026-02-14
Scope: replace inline route deps assembly with `buildRouteDeps(...)`

## Summary
`src/server/src/serverMonolith.ts` now builds one `routeDeps` object from `buildRouteDeps(...)` and uses that object for all route registration calls.

No route logic moved. Registration order remains unchanged.

## Parity Checklist

### Register calls and deps pointers
| Register call | Deps source |
| --- | --- |
| `registerPaymentsWebhookRoute(app, ...)` | `routeDeps.paymentsWebhook` |
| `registerHealthRoutes(app, ...)` | `routeDeps.health` |
| `registerAuthRoutes(app, ...)` | `routeDeps.auth` |
| `registerProfileRoutes(app, ...)` | `routeDeps.profile` |
| `registerSavedInterfacesRoutes(app, ...)` | `routeDeps.savedInterfaces` |
| `registerRupiahAndPaymentsCreateRoutes(app, ...)` | `routeDeps.payments` |
| `registerLlmAnalyzeRoute(app, ...)` | `routeDeps.llmAnalyze` |
| `registerPaymentsStatusRoute(app, ...)` | `routeDeps.payments` |
| `registerLlmPrefillRoute(app, ...)` | `routeDeps.llmPrefill` |
| `registerLlmChatRoute(app, ...)` | `routeDeps.llmChat` |

### Ordering invariants
1. webhook registration is still before CORS:
   - `registerPaymentsWebhookRoute(...)`
   - `app.use(cors(...))`
   - `app.options(/.*/, cors(...))`
2. route ordering after CORS remains the same as pre-run12c.
3. startup gates remain before `listen` in `startServer()`.

### Env read consolidation result
- removed direct monolith `process.env` reads for:
  - `GOOGLE_CLIENT_ID`
  - `MIDTRANS_SERVER_KEY`
- those values are now carried via `serverEnv` into deps builder.

## Code Surface Changed
- `src/server/src/serverMonolith.ts`
  - removed inline per-route deps object assembly
  - added `buildRouteDeps(...)` assembly call
  - removed unused constants and helper no longer needed after deps centralization

## Contract Safety Note
This run is wiring-only from the perspective of route behavior. All route handlers and response logic remain in existing route modules unchanged.
