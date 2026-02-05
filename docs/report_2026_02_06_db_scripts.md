# Report 2026-02-06: DB Scripts + Laptop Workflow

## Summary
- Added PowerShell helper scripts for Cloud SQL proxy, psql, ping, healthcheck, schema, schema dump, and apply.
- Added npm scripts in `src/server/package.json` to run the helpers from the server folder.
- Wrote `docs/db.md` with laptop-first workflow, prerequisites, env vars, and troubleshooting.

## Files Touched
- `src/server/package.json`
- `src/server/scripts/db-env.ps1`
- `src/server/scripts/db-proxy.ps1`
- `src/server/scripts/db-psql.ps1`
- `src/server/scripts/db-ping.ps1`
- `src/server/scripts/db-healthcheck.ps1`
- `src/server/scripts/db-schema.ps1`
- `src/server/scripts/db-dump-schema.ps1`
- `src/server/scripts/db-apply.ps1`
- `docs/db.md`

## Verification
Attempted checks require these env vars in the current shell:
- `INSTANCE_CONNECTION_NAME`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Status:
- Blocked. Env vars were not present in the current session, so the scripts cannot run yet.

Once env vars are set, run from `src/server`:
1) `npm run db:proxy`
2) `npm run db:ping`
3) `npm run db:healthcheck`
4) `npm run db:psql` then exit with `\q`
