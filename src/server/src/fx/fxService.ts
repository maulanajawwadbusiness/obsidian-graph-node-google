import { getPool } from "../db";
import { USD_TO_IDR_PLACEHOLDER } from "../pricing/pricingConfig";

type FxRate = {
  rate: number;
  asOf: string;
  source: string;
};

const PAIR = "USD_IDR";
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const MAX_DB_AGE_MS = 24 * 60 * 60 * 1000;

let cache: { rate: FxRate; expiresAt: number } | null = null;

function nowMs() {
  return Date.now();
}

function isRateSane(rate: number): boolean {
  return Number.isFinite(rate) && rate > 1000 && rate < 100000;
}

function getProvider(): string {
  return (process.env.FX_PROVIDER || "openexchangerates").toLowerCase();
}

function getTtlMs(): number {
  const raw = Number(process.env.FX_CACHE_TTL_MS || DEFAULT_TTL_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_MS;
  return raw;
}

async function fetchOpenExchangeRates(): Promise<FxRate> {
  const appId = process.env.OPENEXCHANGERATES_APP_ID;
  if (!appId) throw new Error("OPENEXCHANGERATES_APP_ID not set");
  const url = `https://openexchangerates.org/api/latest.json?app_id=${encodeURIComponent(appId)}&symbols=IDR`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fx fetch failed: ${resp.status}`);
  const data = await resp.json();
  const rate = Number(data?.rates?.IDR);
  const asOf = data?.timestamp ? new Date(data.timestamp * 1000).toISOString() : new Date().toISOString();
  return { rate, asOf, source: "openexchangerates" };
}

async function fetchFrankfurter(): Promise<FxRate> {
  const url = "https://api.frankfurter.app/latest?from=USD&to=IDR";
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fx fetch failed: ${resp.status}`);
  const data = await resp.json();
  const rate = Number(data?.rates?.IDR);
  const asOf = data?.date ? new Date(`${data.date}T00:00:00Z`).toISOString() : new Date().toISOString();
  return { rate, asOf, source: "frankfurter" };
}

async function fetchProvider(): Promise<FxRate> {
  const provider = getProvider();
  if (provider === "frankfurter") {
    return fetchFrankfurter();
  }
  return fetchOpenExchangeRates();
}

async function saveRate(rate: FxRate): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `insert into fx_rates (pair, rate, as_of, source, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (pair)
     do update set rate = excluded.rate, as_of = excluded.as_of, source = excluded.source, updated_at = now()`,
    [PAIR, rate.rate, rate.asOf, rate.source]
  );
}

async function loadRateFromDb(): Promise<FxRate | null> {
  const pool = await getPool();
  const res = await pool.query(
    `select rate, as_of, source
       from fx_rates
      where pair = $1`,
    [PAIR]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    rate: Number(row.rate),
    asOf: new Date(row.as_of).toISOString(),
    source: String(row.source || "db")
  };
}

function cacheSet(rate: FxRate) {
  cache = { rate, expiresAt: nowMs() + getTtlMs() };
}

export async function getUsdToIdr(): Promise<FxRate> {
  if (cache && cache.expiresAt > nowMs()) return cache.rate;

  try {
    const fresh = await fetchProvider();
    if (!isRateSane(fresh.rate)) throw new Error("fx rate out of range");
    await saveRate(fresh);
    cacheSet(fresh);
    console.log(`[fx] fetched rate=${fresh.rate} source=${fresh.source} as_of=${fresh.asOf}`);
    return fresh;
  } catch (_err) {
    const dbRate = await loadRateFromDb();
    if (dbRate && isRateSane(dbRate.rate)) {
      const ageMs = nowMs() - new Date(dbRate.asOf).getTime();
      if (ageMs <= MAX_DB_AGE_MS) {
        cacheSet({ ...dbRate, source: "db" });
        console.log(`[fx] fallback rate=${dbRate.rate} source=db age_ms=${ageMs}`);
        return { ...dbRate, source: "db" };
      }
    }
  }

  const placeholder: FxRate = {
    rate: USD_TO_IDR_PLACEHOLDER,
    asOf: new Date().toISOString(),
    source: "placeholder"
  };
  cacheSet(placeholder);
  console.log(`[fx] fallback rate=${placeholder.rate} source=placeholder`);
  return placeholder;
}
