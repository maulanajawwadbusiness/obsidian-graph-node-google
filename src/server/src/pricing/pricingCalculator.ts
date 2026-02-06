import { getModelUsdPerToken, MARKUP_MULTIPLIER, USD_TO_IDR_PLACEHOLDER } from "./pricingConfig";

export function estimateIdrCost(opts: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): {
  totalTokens: number;
  usdCost: number;
  idrCost: number;
  idrCostRounded: number;
} {
  const totalTokens = Math.max(0, Math.trunc(opts.inputTokens) + Math.trunc(opts.outputTokens));
  const usdCost = totalTokens * getModelUsdPerToken(opts.model);
  const usdPrice = usdCost * MARKUP_MULTIPLIER;
  const idrCost = usdPrice * USD_TO_IDR_PLACEHOLDER;
  const idrCostRounded = Math.ceil(idrCost);
  return { totalTokens, usdCost, idrCost, idrCostRounded };
}
