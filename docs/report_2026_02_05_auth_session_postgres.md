# Report: Auth Sessions in Postgres (2026-02-05)

## Summary
Replaced in-memory session storage with Postgres-backed sessions and user lookup.

## Changes
- /auth/google now upserts user and inserts a session row.
- /me now reads session cookie and joins sessions to users.
- /auth/logout now deletes the session row and clears the cookie.

## Rationale
Cloud Run scale-out and restarts invalidate in-memory sessions. Sessions must be stored in Postgres.

## Risks and Gaps
- Assumes users table has columns: id, google_sub, email, name, picture.
- Assumes sessions table has columns: id, user_id, expires_at.

## Manual Checks Performed
- Code review only.
