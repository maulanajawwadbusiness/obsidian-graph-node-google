# Docs Drift Hotfix Run A - Drift Checklist

Date: 2026-02-14
Scope: docs/system.md, docs/repo_xray.md, AGENTS.md
Mode: scan only (no target-doc edits in this run)

## Summary
Most backend architecture references are already aligned with the post-run14 shell architecture.
Drift risk is concentrated in precision gaps and duplicated wording, not in major path errors.

## Findings And Required Changes

1) docs/system.md
- Section: Backend Runtime Architecture (`docs/system.md:466`)
- Change needed: Add explicit order invariants in this section so architecture and ordering truth live together (not only implied by test coverage bullets).
- Target wording:
  - webhook route registration is before CORS
  - JSON parser chain is before route registration
  - startup gates run before listen

2) docs/system.md
- Section: Backend Contract Tests (`docs/system.md:550`)
- Change needed: Add explicit mention of shell/order guard script name `test:servermonolith-shell` to avoid relying on implied wording.
- Target wording: include script name directly in coverage bullets.

3) docs/repo_xray.md
- Section: backend seam ownership appears in multiple sections (`docs/repo_xray.md:199` and `docs/repo_xray.md:266`)
- Change needed: remove duplicate/stale shard risk by tightening one repeated seam block and pointing to one canonical backend ownership map.
- Target wording: keep one canonical list, reduce duplicated list text.

4) docs/repo_xray.md
- Section: backend contract command references
- Change needed: ensure `npm run test:contracts` and `test:servermonolith-shell` are both explicitly retained in backend order/invariant area.

5) AGENTS.md
- Section: Backend Runtime Mental Model and Backend Route Add Checklist (`AGENTS.md:37`, `AGENTS.md:91`)
- Change needed: sharpen wording to explicitly tie order-sensitive additions to bootstrap order invariants and shell guard maintenance.
- Target wording:
  - preserve webhook pre-cors, parsers pre-routes, startup gates pre-listen
  - update shell guard markers when order-sensitive changes are made

## Verified Current Script Presence
Confirmed in `src/server/package.json`:
- `test:contracts`
- `test:servermonolith-shell`
- `test:requestflow-contracts`
- `test:jsonparsers-contracts`
- `test:cors-contracts`
- `test:startupgates-contracts`
- `test:health-contracts`
- `test:auth-me-contracts`
- `test:auth-google-contracts`
- `test:profile-contracts`
- `test:saved-interfaces-contracts`
- `test:payments-contracts`
- `test:depsbuilder-contracts`
