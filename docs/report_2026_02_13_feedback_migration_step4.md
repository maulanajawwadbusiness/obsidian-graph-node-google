# Feedback Migration Step 4 Notes (2026-02-13)

## Migration file
- `src/server/migrations/1770384000000_add_feedback_messages.js`

## Final table shape
- table: `public.feedback_messages`
- columns:
  - `id bigserial primary key`
  - `user_id bigint not null references users(id) on delete cascade`
  - `category text not null default ''`
  - `message text not null`
  - `context_json jsonb not null default '{}'::jsonb`
  - `status text not null default 'new'`
  - `created_at timestamptz not null default now()`

## Constraint
- `feedback_messages_status_check`
  - check: `status in ('new','triaged','done')`

## Indexes
- `feedback_messages_created_idx` on `(created_at desc)`
- `feedback_messages_status_created_idx` on `(status, created_at desc)`
- `feedback_messages_user_created_idx` on `(user_id, created_at desc)`

## Run migration locally
```powershell
cd src/server
npm run migrate up
```

## Quick verify in psql
```sql
\d public.feedback_messages
```

## Notes
- This step adds schema only.
- No backend routes and no frontend changes are included.
