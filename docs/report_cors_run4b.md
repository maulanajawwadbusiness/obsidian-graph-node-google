# Run4b Report: Wire serverMonolith to cors seam

Date: 2026-02-14
Scope: replace inline cors options object with buildCorsOptions
Status: completed

## Summary

Updated `src/server/src/serverMonolith.ts`:
- removed inline `corsOptions` object literal
- replaced with:
  - `const corsOptions = buildCorsOptions({ allowedOrigins: corsAllowedOrigins });`

## Parity Checklist

Webhook-before-CORS invariant:
- preserved
- `POST /api/payments/webhook` remains before:
  - `app.use(cors(corsOptions));`
  - `app.options(/.*/, cors(corsOptions));`

Origin callback log and error strings:
- preserved exactly via cors module behavior
  - allowed log: `[cors] allowed origin: ${origin}`
  - blocked warn: `[cors] blocked origin: ${origin}`
  - blocked error: `CORS blocked origin: ${origin}`

CORS option fields:
- `credentials: true` unchanged
- `methods: ["GET", "POST", "OPTIONS"]` unchanged
- `allowedHeaders: ["Content-Type", "Authorization"]` unchanged

Prod warning location and string:
- unchanged in monolith
- no duplicated warning logic introduced in cors module

## Verification

Command run in `src/server`:
```powershell
npm run build
```

Result:
- pass (`tsc` exit code 0)
