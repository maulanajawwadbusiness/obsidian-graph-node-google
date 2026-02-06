import { estimateTokensFromText } from "../../pricing/tokenEstimate";
import type { LogicalModel } from "../models/logicalModels";
import { normalizeUsage, type ProviderUsage } from "./providerUsage";
import { countTokensForMessages, countTokensForText, messagesToCanonicalText } from "./tokenCounter";

export type UsageRecord = {
  provider: "openai" | "openrouter";
  logical_model: LogicalModel;
  provider_model_id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  source: "provider_usage" | "tokenizer_count" | "estimate_wordcount";
  notes?: string;
  tokenizer_encoding_used?: string;
  tokenizer_fallback_reason?: string;
};

type UsageTrackerState = {
  provider: "openai" | "openrouter";
  logical_model: LogicalModel;
  provider_model_id: string;
  input_tokens_est: number;
  output_tokens_est: number;
  output_carry: string;
  input_text: string;
  input_messages_text: string;
  output_text: string;
  output_truncated: boolean;
  input_truncated: boolean;
  finalized: boolean;
  finalized_result: UsageRecord | null;
  request_id?: string;
};

const MAX_TOKENIZER_TEXT_CHARS = 2_000_000;

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
  request_id?: string;
}) {
  const state: UsageTrackerState = {
    provider: ctx.provider,
    logical_model: ctx.logical_model,
    provider_model_id: ctx.provider_model_id,
    input_tokens_est: 0,
    output_tokens_est: 0,
    output_carry: "",
    input_text: "",
    input_messages_text: "",
    output_text: "",
    output_truncated: false,
    input_truncated: false,
    finalized: false,
    finalized_result: null,
    request_id: ctx.request_id
  };

  function recordInputText(input: unknown) {
    const text = normalizeInput(input);
    if (!text) return;
    state.input_tokens_est += estimateTokensFromText(text);
    if (!state.input_truncated) {
      if (state.input_text.length + text.length > MAX_TOKENIZER_TEXT_CHARS) {
        state.input_truncated = true;
      } else {
        state.input_text += text;
      }
    }
  }

  function recordInputMessages(messages: Array<{ role?: string; content?: string; text?: string }>) {
    const canonical = messagesToCanonicalText(messages);
    if (!canonical) return;
    state.input_tokens_est += estimateTokensFromText(canonical);
    if (!state.input_truncated) {
      if (state.input_messages_text.length + canonical.length > MAX_TOKENIZER_TEXT_CHARS) {
        state.input_truncated = true;
      } else {
        state.input_messages_text += canonical;
      }
    }
  }

  function recordOutputChunk(chunk: string) {
    if (!chunk) return;
    const counted = countWordsWithCarry(chunk, state.output_carry);
    state.output_tokens_est += counted.count;
    state.output_carry = counted.carry;
    if (!state.output_truncated) {
      if (state.output_text.length + chunk.length > MAX_TOKENIZER_TEXT_CHARS) {
        state.output_truncated = true;
      } else {
        state.output_text += chunk;
      }
    }
  }

  function recordOutputText(text: string) {
    if (!text) return;
    state.output_tokens_est += estimateTokensFromText(text);
    state.output_carry = "";
    if (!state.output_truncated) {
      if (state.output_text.length + text.length > MAX_TOKENIZER_TEXT_CHARS) {
        state.output_truncated = true;
      } else {
        state.output_text += text;
      }
    }
  }

  async function finalize(opts: { providerUsage?: ProviderUsage | null }): Promise<UsageRecord> {
    if (state.finalized && state.finalized_result) {
      return state.finalized_result;
    }
    const providerUsage = normalizeUsage(opts.providerUsage || null);
    const providerInput = providerUsage?.input_tokens;
    const providerOutput = providerUsage?.output_tokens;
    const providerTotal = providerUsage?.total_tokens;
    const hasProvider = Number.isFinite(providerInput) || Number.isFinite(providerOutput) || Number.isFinite(providerTotal);
    if (hasProvider) {
      const inputTokens = Number.isFinite(providerInput) ? Number(providerInput) : state.input_tokens_est;
      const outputTokens = Number.isFinite(providerOutput) ? Number(providerOutput) : state.output_tokens_est;
      const totalTokens = Number.isFinite(providerTotal) ? Number(providerTotal) : inputTokens + outputTokens;
      const result: UsageRecord = {
        provider: state.provider,
        logical_model: state.logical_model,
        provider_model_id: state.provider_model_id,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        source: "provider_usage"
      };
      state.finalized = true;
      state.finalized_result = result;
      if (state.request_id) {
        console.log(JSON.stringify({
          event: "usage_finalize",
          request_id: state.request_id,
          provider: state.provider,
          logical_model: state.logical_model,
          usage_source: result.source,
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
          total_tokens: result.total_tokens
        }));
      }
      return result;
    }

    if (!state.input_truncated && !state.output_truncated) {
      const inputTokenResult = state.input_messages_text
        ? await countTokensForText({
            provider: state.provider,
            providerModelId: state.provider_model_id,
            logicalModel: state.logical_model,
            text: state.input_messages_text
          })
        : await countTokensForText({
            provider: state.provider,
            providerModelId: state.provider_model_id,
            logicalModel: state.logical_model,
            text: state.input_text
          });
      const outputTokenResult = await countTokensForText({
        provider: state.provider,
        providerModelId: state.provider_model_id,
        logicalModel: state.logical_model,
        text: state.output_text
      });
      if (inputTokenResult && outputTokenResult) {
        const result: UsageRecord = {
          provider: state.provider,
          logical_model: state.logical_model,
          provider_model_id: state.provider_model_id,
          input_tokens: inputTokenResult.tokens,
          output_tokens: outputTokenResult.tokens,
          total_tokens: inputTokenResult.tokens + outputTokenResult.tokens,
          source: "tokenizer_count",
          tokenizer_encoding_used: inputTokenResult.encoding
        };
        state.finalized = true;
        state.finalized_result = result;
        if (state.request_id) {
          console.log(JSON.stringify({
            event: "usage_finalize",
            request_id: state.request_id,
            provider: state.provider,
            logical_model: state.logical_model,
            usage_source: result.source,
            input_tokens: result.input_tokens,
            output_tokens: result.output_tokens,
            total_tokens: result.total_tokens,
            tokenizer_encoding_used: result.tokenizer_encoding_used ?? null
          }));
        }
        return result;
      }
    }

    const totalTokens = state.input_tokens_est + state.output_tokens_est;
    const result: UsageRecord = {
      provider: state.provider,
      logical_model: state.logical_model,
      provider_model_id: state.provider_model_id,
      input_tokens: state.input_tokens_est,
      output_tokens: state.output_tokens_est,
      total_tokens: totalTokens,
      source: "estimate_wordcount",
      tokenizer_fallback_reason: state.input_truncated || state.output_truncated
        ? "text_too_large"
        : state.input_text.length === 0 && state.input_messages_text.length === 0
          ? "missing_input"
          : "tokenizer_unavailable"
    };
    state.finalized = true;
    state.finalized_result = result;
    if (state.request_id) {
      console.log(JSON.stringify({
        event: "usage_finalize",
        request_id: state.request_id,
        provider: state.provider,
        logical_model: state.logical_model,
        usage_source: result.source,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        total_tokens: result.total_tokens,
        tokenizer_fallback_reason: result.tokenizer_fallback_reason ?? null
      }));
    }
    return result;
  }

  function getInputTokensEstimate() {
    return state.input_tokens_est;
  }

  function getOutputTokensEstimate() {
    return state.output_tokens_est;
  }

  return {
    recordInputText,
    recordInputMessages,
    recordOutputChunk,
    recordOutputText,
    finalize,
    getInputTokensEstimate,
    getOutputTokensEstimate
  };
}
