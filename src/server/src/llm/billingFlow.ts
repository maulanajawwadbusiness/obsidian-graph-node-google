import { getUsdToIdr } from "../fx/fxService";
import { estimateIdrCost } from "../pricing/pricingCalculator";
import { chargeForLlm, getBalance } from "../rupiah/rupiahService";
import { recordTokenSpend } from "./freePoolAccounting";
import type { ProviderPolicyMeta } from "./providerRouter";

export async function estimateWithFx(opts: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const fx = await getUsdToIdr();
  const fxRate = fx.rate;
  const pricing = estimateIdrCost({
    model: opts.model,
    inputTokens: opts.inputTokens,
    outputTokens: opts.outputTokens,
    fxRate
  });
  return { fxRate, pricing };
}

export async function precheckBalance(opts: {
  userId: string;
  neededIdr: number;
  bypassBalance: boolean;
}) {
  if (opts.bypassBalance) {
    return { ok: true as const, balance_idr: null as number | null };
  }
  const balanceSnapshot = await getBalance(opts.userId);
  if (balanceSnapshot.balance_idr < opts.neededIdr) {
    return {
      ok: false as const,
      balance_idr: balanceSnapshot.balance_idr,
      shortfall_idr: opts.neededIdr - balanceSnapshot.balance_idr
    };
  }
  return { ok: true as const, balance_idr: balanceSnapshot.balance_idr };
}

export async function chargeUsage(opts: {
  userId: string;
  requestId: string;
  model: string;
  totalTokens: number;
  amountIdr: number;
  bypassBalance: boolean;
}) {
  if (opts.bypassBalance) {
    return {
      ok: true as const,
      rupiahCost: 0,
      rupiahBefore: null as number | null,
      rupiahAfter: null as number | null,
      chargeStatus: "bypassed_dev" as const
    };
  }

  const chargeResult = await chargeForLlm({
    userId: opts.userId,
    requestId: opts.requestId,
    amountIdr: opts.amountIdr,
    meta: { model: opts.model, totalTokens: opts.totalTokens }
  });

  if (chargeResult.ok === false) {
    return {
      ok: false as const,
      balance_idr: chargeResult.balance_idr,
      shortfall_idr: opts.amountIdr - chargeResult.balance_idr
    };
  }

  return {
    ok: true as const,
    rupiahCost: opts.amountIdr,
    rupiahBefore: chargeResult.balance_before,
    rupiahAfter: chargeResult.balance_after,
    chargeStatus: "charged" as const
  };
}

export async function applyFreepoolLedger(opts: {
  providerName: "openai" | "openrouter" | null;
  policyMeta: ProviderPolicyMeta | null;
  requestId: string;
  userId: string;
  tokensUsed: number;
}) {
  if (opts.providerName !== "openai") {
    return { applied: false, decrement: 0, reason: opts.policyMeta ? "provider_not_openai" : "policy_missing" };
  }
  if (!opts.policyMeta) {
    return { applied: false, decrement: 0, reason: "policy_missing" };
  }

  const eligible = opts.policyMeta.cohort_selected && opts.policyMeta.reason === "free_ok";
  if (!eligible) {
    return {
      applied: false,
      decrement: 0,
      reason: opts.policyMeta.cohort_selected ? "cap_exhausted" : "not_in_cohort"
    };
  }

  try {
    const applied = await recordTokenSpend({
      requestId: opts.requestId,
      userId: opts.userId,
      dateKey: opts.policyMeta.date_key,
      tokensUsed: opts.tokensUsed
    });
    return {
      applied: applied.applied,
      decrement: applied.applied ? opts.tokensUsed : 0,
      reason: applied.applied ? "applied" : "already_ledgered"
    };
  } catch {
    return { applied: false, decrement: 0, reason: "error" };
  }
}

