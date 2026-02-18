# Run 2 Caps Report
Date: 2026-02-18
Scope: database schema for daily beta word usage.

## Changes
- Added migration:
  - `src/server/migrations/1770384000000_add_beta_daily_word_usage.js`
- New table: `beta_daily_word_usage`
  - `date_key text not null`
  - `user_id bigint not null references users(id) on delete cascade`
  - `used_words bigint not null default 0`
  - `updated_at timestamptz not null default now()`
  - primary key `(date_key, user_id)`

## Rationale
- Dedicated table keeps beta caps independent from free-pool token tables.
- Easier rollback and future cleanup when beta caps are disabled.
- Matches existing daily-key model used by provider policy (`UTC` date key).

## Day boundary note
- Daily key is UTC-based in current server policy seams.
- For WIB users, reset is effectively 07:00 WIB.

## Verification
- `src/server`: `npm run build` passed.
