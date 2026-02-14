# Run 14c Report: Env Hygiene Sweep

Date: 2026-02-14
Scope: classify all `process.env` reads in `src/server/src` and centralize only bootstrap-owned envs

## Summary
- Performed full env-read sweep across `src/server/src`.
- Bootstrap-owned env reads were already centralized in `src/server/src/server/envConfig.ts`.
- No additional env values were moved in this run.
- Added env ownership contract comment to `envConfig.ts` to prevent future drift.

## Env Classification Table

| Env Var | Location(s) | Classification | Action |
| --- | --- | --- | --- |
| `PORT` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `SESSION_COOKIE_NAME` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `SESSION_TTL_MS` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `ALLOWED_ORIGINS` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `MAX_SAVED_INTERFACE_PAYLOAD_BYTES` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `SAVED_INTERFACE_JSON_LIMIT` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `GOOGLE_CLIENT_ID` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `MIDTRANS_SERVER_KEY` | `server/envConfig.ts`, `midtrans/client.ts`, `midtrans/client.selftest.ts` | B: mixed (bootstrap + midtrans domain transport/test) | kept bootstrap copy in envConfig and domain reads local |
| `ALLOW_OPENROUTER_ANALYZE` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `OPENROUTER_ANALYZE_MODELS` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `DEV_BYPASS_BALANCE` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `K_SERVICE` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `NODE_ENV` | `server/envConfig.ts` | A: bootstrap-owned | kept in envConfig |
| `INSTANCE_CONNECTION_NAME` | `db.ts`, `authSchemaGuard.ts` | B: db/auth-schema domain-owned | left local |
| `DB_USER` | `db.ts` | B: db domain-owned | left local |
| `DB_PASSWORD` | `db.ts` | B: db domain-owned | left local |
| `DB_NAME` | `db.ts`, `authSchemaGuard.ts` | B: db/auth-schema domain-owned | left local |
| `DB_CONNECT_TIMEOUT_MS` | `db.ts` | B: db domain-owned | left local |
| `OPENAI_API_KEY` | `llm/llmClient.ts` | B: llm provider domain-owned | left local |
| `OPENAI_RESPONSES_URL` | `llm/llmClient.ts` | B: llm provider domain-owned | left local |
| `OPENROUTER_API_KEY` | `llm/getProvider.ts`, `llm/providers/openrouterProvider.ts` | B: llm provider domain-owned | left local |
| `OPENROUTER_BASE_URL` | `llm/providers/openrouterProvider.ts` | B: llm provider domain-owned | left local |
| `OPENROUTER_HTTP_REFERER` | `llm/providers/openrouterProvider.ts` | B: llm provider domain-owned | left local |
| `OPENROUTER_X_TITLE` | `llm/providers/openrouterProvider.ts` | B: llm provider domain-owned | left local |
| `MODEL_*` env keys | `llm/models/modelMap.ts` | B: llm model mapping domain-owned | left local |
| `FX_PROVIDER` | `fx/fxService.ts` | B: fx domain-owned | left local |
| `FX_CACHE_TTL_MS` | `fx/fxService.ts` | B: fx domain-owned | left local |
| `OPENEXCHANGERATES_APP_ID` | `fx/fxService.ts` | B: fx domain-owned | left local |

## Why these B-class reads remain local
1. They are consumed by domain modules directly and not by bootstrap route wiring.
2. Pulling them into envConfig would increase coupling and force unrelated bootstrap config surface growth.
3. Current behavior parity is safest with domain-local env ownership for provider/db/transport internals.

## Code Change in This Run
- `src/server/src/server/envConfig.ts`
  - added env ownership boundary comment.

## Behavior Parity
- No defaults changed.
- No parsing logic changed.
- No runtime behavior change intended.
