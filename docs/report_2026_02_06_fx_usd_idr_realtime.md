# USD to IDR FX Service (Realtime-ish)

Date: 2026-02-06
Scope: FX provider fetch, caching, DB persistence, and pricingCalculator integration

## Summary
Implemented a pluggable FX service that fetches USD to IDR from an external provider, caches it with TTL, persists the last good rate to the database, and falls back to a placeholder when needed. Pricing now uses live FX when available.

## Provider
Default provider: Open Exchange Rates (hourly updates, free plan).
Fallback provider: Frankfurter (no key required).

## Environment Variables
- `FX_PROVIDER` = `openexchangerates` or `frankfurter`
- `OPENEXCHANGERATES_APP_ID` (required for Open Exchange Rates)
- `FX_CACHE_TTL_MS` (default 3600000)

## Schema
Migration: `src/server/migrations/1770380000000_add_fx_rates.js`

Table: `fx_rates`
- `pair` text PK
- `rate` double precision
- `as_of` timestamptz
- `source` text
- `updated_at` timestamptz

## FX Service
File: `src/server/src/fx/fxService.ts`

Behavior:
1) Check in-memory cache (TTL).
2) Fetch from provider and validate rate sanity (1000..100000).
3) Upsert into DB and update cache.
4) If provider fails: fallback to DB rate (if not older than 24h).
5) If DB rate is missing or too old: fallback to placeholder 17000.

Logging:
- Logs only rate, source, and age; no secrets.

## Pricing Integration
File: `src/server/src/pricing/pricingCalculator.ts`

- Calculator now accepts `fxRate` from `fxService`.
- LLM endpoints call `getUsdToIdr()` before cost calculations.

## Verification Checklist
- First call triggers provider fetch and DB upsert.
- Second call within TTL hits cache.
- Simulated provider failure uses DB rate.
- If DB rate is stale, uses placeholder 17000.
