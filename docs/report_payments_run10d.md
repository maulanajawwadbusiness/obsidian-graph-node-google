# Run 10d Report: Payments Contract Guards

Date: 2026-02-14
Scope: deterministic payment route contract guards without real DB or Midtrans

## Added Scripts
- `src/server/scripts/test-rupiah-contracts.mjs`
- `src/server/scripts/test-payments-create-status-contracts.mjs`
- `src/server/scripts/test-payments-webhook-contracts.mjs`
- `src/server/scripts/test-payments-contracts.mjs` (umbrella runner)

## Added npm scripts
- `test:rupiah-contracts`
- `test:payments-create-status-contracts`
- `test:payments-webhook-contracts`
- `test:payments-contracts`

## What Is Locked
- Rupiah endpoint contract:
  - `GET /api/rupiah/me` returns 200 with stable keys
- Create/status route contracts:
  - create success returns `ok:true` with expected key surface
  - create failure maps to 502 and `ok:false`
  - status missing order maps to 404
  - pending status Midtrans success returns `ok:true` shape
  - pending status Midtrans failure still returns `ok:true` with `midtrans_error`
- Webhook contracts:
  - invalid signature still responds 200 and finalizes path
  - verified paid path can trigger `applyTopupFromMidtrans`
  - finalize failure maps to `200` with `{ ok:false, error:"failed to finalize webhook" }`

## What Is Not Locked
- exact SQL strings beyond minimal fake matcher behavior
- real DB transaction semantics
- Midtrans external behavior and network timing
- log text parity

## Notes
- Tests focus on stable route contract surfaces (status/body/key presence) and brittle branching behavior.
- Parser/CORS ordering is validated by wiring and run10c checklist, not by these route-level tests.
