import { getProvider } from "./getProvider";
import { getTodayDateKey, selectProvider } from "./providerSelector";

export type ProviderPolicyMeta = {
  cohort_selected: boolean;
  user_used_tokens_today: number;
  user_free_cap: number;
  pool_remaining_tokens: number;
  reason: "not_in_cohort" | "cap_exhausted" | "pool_exhausted" | "free_ok";
  date_key: string;
};

export async function pickProviderForRequest(opts: {
  userId: string;
  dateKey?: string;
  endpointKind?: "chat" | "analyze" | "prefill";
}): Promise<{ selectedProviderName: "openai" | "openrouter"; provider: ReturnType<typeof getProvider>; policyMeta: ProviderPolicyMeta }> {
  const dateKey = opts.dateKey || getTodayDateKey();
  const choice = await selectProvider({ userId: opts.userId, dateKey, endpointKind: opts.endpointKind });
  const providerName = choice.provider;
  const provider = getProvider(providerName);

  let reason: ProviderPolicyMeta["reason"] = "free_ok";
  if (!choice.is_free_user) reason = "not_in_cohort";
  if (choice.reason === "pool_exhausted") reason = "pool_exhausted";
  if (choice.reason === "cap_exceeded") reason = "cap_exhausted";

  return {
    selectedProviderName: providerName,
    provider,
    policyMeta: {
      cohort_selected: choice.is_free_user,
      user_used_tokens_today: choice.user_used_tokens,
      user_free_cap: choice.user_cap,
      pool_remaining_tokens: choice.remaining_tokens,
      reason,
      date_key: choice.date_key
    }
  };
}
