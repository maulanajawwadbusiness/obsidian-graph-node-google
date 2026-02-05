# Database Laptop Workflow (Cloud SQL + Postgres)

## What This Is For
We run database operations from the laptop to keep routine work fast, consistent, and repeatable. No manual edits in Cloud Console.

## Prerequisites
- Google Cloud SDK installed (`gcloud`)
- Authenticated with ADC:
  - `gcloud auth application-default login`
- Cloud SQL Auth Proxy installed and on PATH:
  - `cloud-sql-proxy --help`
- Postgres client tools installed (`psql`, `pg_dump`)

## Required Environment Variables
Set these in your shell before running the scripts:
- `INSTANCE_CONNECTION_NAME` (example: `arnvoid-project:asia-southeast2:arnvoid-postgres`)
- `DB_NAME` (example: `arnvoid`)
- `DB_USER` (example: `arnvoid_app`)
- `DB_PASSWORD` (example: `your_password_here`)
- `DATABASE_URL` (optional, used by `npm run migrate`, example: `postgres://DB_USER:DB_PASSWORD@127.0.0.1:5432/DB_NAME`)

## Where To Run
Run all commands from `src/server`:
```
cd src/server
```

## One-Command Workflow
1) Start proxy (leave it running):
```
npm run db:proxy
```

2) Ping the DB:
```
npm run db:ping
```

3) Open psql:
```
npm run db:psql
```

4) Example queries:
```
select now();
select * from healthcheck order by id desc limit 10;
```

## Other Commands
- Healthcheck:
```
npm run db:healthcheck
```

- List tables:
```
npm run db:schema
```

- Dump schema to `docs/db/schema.sql`:
```
npm run db:dump:schema
```

- Run migrations (requires `DATABASE_URL` and proxy):
```
npm run migrate
```

- Apply a single SQL file (`docs/db/next.sql`):
```
npm run db:apply
```

## Troubleshooting
- Port 5432 in use:
  - Stop the conflicting service or change the proxy port and update scripts accordingly.
- Permission denied / auth:
  - Run `gcloud auth application-default login`
  - Ensure your account has Cloud SQL access.
- `psql` not found:
  - Add `C:\Program Files\PostgreSQL\18\bin` to PATH and restart the terminal.

## Safety Rules
- Do not edit schema in Cloud Console.
- Prefer SQL files checked into docs for repeatability.
- Keep secrets out of scripts and docs.
