# Run 3 Report: RequestFlow Contract Guards

Date: 2026-02-14
Scope: add anti-drift tests for requestflow mapping and send ordering
Status: completed, tests passing

## 1. Added Test Guard

New file:
- `src/server/scripts/test-requestflow-contracts.mjs`

Coverage added:
1. `mapLlmErrorToStatus` matrix lock
2. `mapTerminationReason` matrix lock
3. `sendApiError` header ordering and presence lock
4. `sendApiError` default (no extra headers) behavior lock

## 2. npm Script Wiring

Updated:
- `src/server/package.json`

Added script:
- `test:requestflow-contracts`

Script value:
- `node scripts/test-requestflow-contracts.mjs`

Build and test are run in sequence from shell to avoid shell parsing pitfalls:
1. `npm run build`
2. `npm run test:requestflow-contracts`

## 3. Locked Contracts

## 3.1 Status mapping matrix

- `bad_request -> 400`
- `rate_limited -> 429`
- `timeout -> 504`
- `parse_error -> 502`
- `unauthorized -> 401`
- default -> `502`

## 3.2 Termination mapping matrix

- `(402, *) -> insufficient_rupiah`
- `(429, *) -> rate_limited`
- `(400|413, *) -> validation_error`
- `(504, *)` or `(*, timeout) -> timeout`
- `(*, structured_output_invalid) -> structured_output_invalid`
- `(*>=500, *)` or `(*, upstream_error) -> upstream_error`
- `(200, *) -> success`
- fallback -> `upstream_error`

## 3.3 sendApiError ordering

Test verifies:
1. `X-Request-Id` is set
2. optional headers (for example `Retry-After`) are set
3. header set operations occur before `status(...).json(...)`
4. no-header path does not inject unrelated headers

## 4. Verification Output

Commands run in `src/server`:
```powershell
npm run build
npm run test:requestflow-contracts
```

Observed output:
- `[requestflow-contracts] mapLlmErrorToStatus matrix ok`
- `[requestflow-contracts] mapTerminationReason matrix ok`
- `[requestflow-contracts] sendApiError header ordering ok`
- `[requestflow-contracts] sendApiError default path ok`
- `[requestflow-contracts] done`

## 5. Runtime parity note

This run added deterministic helper-level contract tests. Full endpoint runtime replay (`/api/llm/*`) was not executed in this shell because it requires running backend server and auth/session context. Static helper contracts and TypeScript build are now guarded.
