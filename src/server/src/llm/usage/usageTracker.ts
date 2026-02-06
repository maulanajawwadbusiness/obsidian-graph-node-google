import { estimateTokensFromText } from "../../pricing/tokenEstimate";
import type { LogicalModel } from "../models/logicalModels";

export type ProviderUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

export type UsageRecord = {
  provider: "openai" | "openrouter";
  logical_model: LogicalModel;
  provider_model_id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  source: "provider_usage" | "estimate_wordcount";
  notes?: string;
};

type UsageTrackerState = {
  provider: "openai" | "openrouter";
  logical_model: LogicalModel;
  provider_model_id: string;
  input_tokens_est: number;
  output_tokens_est: number;
  output_carry: string;
};

function countWordsWithCarry(text: string, carry: string) {
  const combined = carry + text;
  if (!combined) return { count: 0, carry: "" };
  const parts = combined.split(/\s+/);
  const endsWithSpace = /\s$/.test(combined);
  let nextCarry = "";
  let countParts = parts;
  if (!endsWithSpace) {
    nextCarry = parts.pop() || "";
    countParts = parts;
  }
  const count = countParts.filter((part) => part.length > 0).length;
  return { count, carry: nextCarry };
}

function normalizeInput(input: unknown): string {
  if (typeof input === "string") return input;
  if (Array.isArray(input)) {
    return input
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const maybeText = (entry as { text?: unknown }).text;
        const maybeContent = (entry as { content?: unknown }).content;
        if (typeof maybeText === "string") return maybeText;
        if (typeof maybeContent === "string") return maybeContent;
        return "";
      })
      .join("\n");
  }
  if (input && typeof input === "object") {
    const messages = (input as { messages?: unknown }).messages;
    if (Array.isArray(messages)) return normalizeInput(messages);
  }
  return "";
}

export function initUsageTracker(ctx: {
  provider: "openai" | "openrouter";
  logical_model: LogicalModel;
  provider_model_id: string;
}) {
  const state: UsageTrackerState = {
    provider: ctx.provider,
    logical_model: ctx.logical_model,
    provider_model_id: ctx.provider_model_id,
    input_tokens_est: 0,
    output_tokens_est: 0,
    output_carry: ""
  };

  function recordInputText(input: unknown) {
    const text = normalizeInput(input);
    if (!text) return;
    state.input_tokens_est += estimateTokensFromText(text);
  }

  function recordOutputChunk(chunk: string) {
    if (!chunk) return;
    const counted = countWordsWithCarry(chunk, state.output_carry);
    state.output_tokens_est += counted.count;
    state.output_carry = counted.carry;
  }

  function recordOutputText(text: string) {
    if (!text) return;
    state.output_tokens_est += estimateTokensFromText(text);
    state.output_carry = "";
  }

  function finalize(opts: { providerUsage?: ProviderUsage }): UsageRecord {
    const providerUsage = opts.providerUsage;
    const providerInput = providerUsage?.input_tokens;
    const providerOutput = providerUsage?.output_tokens;
    const providerTotal = providerUsage?.total_tokens;
    const hasProvider = Number.isFinite(providerInput) || Number.isFinite(providerOutput) || Number.isFinite(providerTotal);
    if (hasProvider) {
      const inputTokens = Number.isFinite(providerInput) ? Number(providerInput) : state.input_tokens_est;
      const outputTokens = Number.isFinite(providerOutput) ? Number(providerOutput) : state.output_tokens_est;
      const totalTokens = Number.isFinite(providerTotal) ? Number(providerTotal) : inputTokens + outputTokens;
      return {
        provider: state.provider,
        logical_model: state.logical_model,
        provider_model_id: state.provider_model_id,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        source: "provider_usage"
      };
    }

    const totalTokens = state.input_tokens_est + state.output_tokens_est;
    return {
      provider: state.provider,
      logical_model: state.logical_model,
      provider_model_id: state.provider_model_id,
      input_tokens: state.input_tokens_est,
      output_tokens: state.output_tokens_est,
      total_tokens: totalTokens,
      source: "estimate_wordcount"
    };
  }

  function getInputTokensEstimate() {
    return state.input_tokens_est;
  }

  function getOutputTokensEstimate() {
    return state.output_tokens_est;
  }

  return {
    recordInputText,
    recordOutputChunk,
    recordOutputText,
    finalize,
    getInputTokensEstimate,
    getOutputTokensEstimate
  };
}
