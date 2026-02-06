export const MODEL_PRICE_USD_PER_MTOKEN_COMBINED: Record<string, number> = {
  "gpt-5.2": 15.75,
  "gpt-5.1": 11.25,
  "gpt-5-mini": 2.25,
  "gpt-5-nano": 0.45
};

export const MARKUP_MULTIPLIER = 1.5;
export const USD_TO_IDR_PLACEHOLDER = 17000;

export function getModelUsdPerToken(model: string): number {
  const usdPerM = MODEL_PRICE_USD_PER_MTOKEN_COMBINED[model] ?? 0;
  return usdPerM / 1_000_000;
}
