# Run4c Report: CORS Contract Guard

Date: 2026-02-14
Scope: deterministic CORS contract script
Status: completed, tests passing

## Summary

Added guard script:
- `src/server/scripts/test-cors-contracts.mjs`

Added npm script:
- `test:cors-contracts`

## Locked Invariants

Script constructs a tiny express app with:
- `const corsOptions = buildCorsOptions({ allowedOrigins: ["https://allowed.test"] })`
- `app.use(cors(corsOptions))`
- `app.options(/.*/, cors(corsOptions))`
- `GET /ok` route

Assertions:

1) Allowed origin GET:
- request `Origin: https://allowed.test`
- expects status `200`
- expects `access-control-allow-origin: https://allowed.test`
- expects `access-control-allow-credentials: true`

2) Blocked origin GET:
- request `Origin: https://blocked.test`
- expects non-2xx status
- expects no `access-control-allow-origin` header

3) Allowed preflight OPTIONS:
- request headers:
  - `Origin: https://allowed.test`
  - `Access-Control-Request-Method: POST`
  - `Access-Control-Request-Headers: Content-Type`
- expects status `204` or `200`
- expects `access-control-allow-origin: https://allowed.test`
- expects allow methods include `GET`, `POST`, `OPTIONS`
- expects allow headers include `Content-Type` and `Authorization`

## Verification

Commands run in `src/server`:
```powershell
npm run build
npm run test:cors-contracts
```

Observed output includes:
- `[cors-contracts] allowed origin GET headers ok`
- `[cors-contracts] blocked origin GET contract ok`
- `[cors-contracts] allowed preflight contract ok`
- `[cors-contracts] done`
