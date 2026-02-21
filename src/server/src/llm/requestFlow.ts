import type express from "express";
import { MODEL_PRICE_USD_PER_MTOKEN_COMBINED } from "../pricing/pricingConfig";
import type { LlmError } from "./llmClient";
import type { ProviderUsage } from "./usage/providerUsage";

export type ApiErrorCode =
  | "bad_request"
  | "MODE_DISABLED"
  | "too_large"
  | "unauthorized"
  | "insufficient_rupiah"
  | "beta_cap_exceeded"
  | "beta_daily_exceeded"
  | "rate_limited"
  | "upstream_error"
  | "timeout"
  | "parse_error"
  | "structured_output_invalid"
  | "skeleton_output_invalid";

export type ApiError = {
  ok: false;
  request_id: string;
  code: ApiErrorCode;
  error: string;
  [key: string]: unknown;
};

export function sendApiError(
  res: express.Response,
  status: number,
  body: ApiError,
  opts?: { headers?: Record<string, string> }
) {
  res.setHeader("X-Request-Id", body.request_id);
  if (opts?.headers) {
    for (const [key, value] of Object.entries(opts.headers)) {
      res.setHeader(key, value);
    }
  }
  res.status(status).json(body);
}

export function mapLlmErrorToStatus(error: LlmError): number {
  switch (error.code) {
    case "bad_request":
      return 400;
    case "rate_limited":
      return 429;
    case "timeout":
      return 504;
    case "parse_error":
      return 502;
    case "unauthorized":
      return 401;
    default:
      return 502;
  }
}

export function mapTerminationReason(statusCode: number, code?: string) {
  if (statusCode === 402 || code === "insufficient_rupiah") return "insufficient_rupiah";
  if (statusCode === 429) return "rate_limited";
  if (statusCode === 400 || statusCode === 413) return "validation_error";
  if (statusCode === 504 || code === "timeout") return "timeout";
  if (code === "skeleton_output_invalid") return "skeleton_output_invalid";
  if (code === "structured_output_invalid") return "structured_output_invalid";
  if (code === "upstream_error" || statusCode >= 500) return "upstream_error";
  if (statusCode === 200) return "success";
  return "upstream_error";
}

export function getUsageFieldList(usage: ProviderUsage | null | undefined): string[] {
  const fields: string[] = [];
  if (!usage) return fields;
  if (usage.input_tokens !== undefined) fields.push("input");
  if (usage.output_tokens !== undefined) fields.push("output");
  if (usage.total_tokens !== undefined) fields.push("total");
  return fields;
}

export function getPriceUsdPerM(model: string): number | null {
  const value = MODEL_PRICE_USD_PER_MTOKEN_COMBINED[model];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function logLlmRequest(fields: {
  request_id: string;
  endpoint: string;
  user_id: string;
  model: string;
  input_chars: number;
  output_chars: number;
  duration_ms: number;
  time_to_first_token_ms?: number | null;
  status_code: number;
  termination_reason: string;
  rupiah_cost?: number | null;
  rupiah_balance_before?: number | null;
  rupiah_balance_after?: number | null;
  provider?: "openai" | "openrouter" | null;
  provider_model_id?: string | null;
  structured_output_mode?: string | null;
  validation_result?: string | null;
  usage_input_tokens?: number | null;
  usage_output_tokens?: number | null;
  usage_total_tokens?: number | null;
  usage_source?: string | null;
  provider_usage_present?: boolean | null;
  provider_usage_source?: string | null;
  provider_usage_fields_present?: string[] | null;
  tokenizer_encoding_used?: string | null;
  tokenizer_fallback_reason?: string | null;
  freepool_decrement_tokens?: number | null;
  freepool_decrement_applied?: boolean | null;
  freepool_decrement_reason?: string | null;
}) {
  console.log(JSON.stringify({
    request_id: fields.request_id,
    endpoint: fields.endpoint,
    user_id: fields.user_id,
    model: fields.model,
    provider: fields.provider ?? null,
    provider_model_id: fields.provider_model_id ?? null,
    input_chars: fields.input_chars,
    output_chars: fields.output_chars,
    duration_ms: fields.duration_ms,
    time_to_first_token_ms: fields.time_to_first_token_ms ?? null,
    status_code: fields.status_code,
    termination_reason: fields.termination_reason,
    usage_input_tokens: fields.usage_input_tokens ?? null,
    usage_output_tokens: fields.usage_output_tokens ?? null,
    usage_total_tokens: fields.usage_total_tokens ?? null,
    usage_source: fields.usage_source ?? null,
    provider_usage_present: fields.provider_usage_present ?? null,
    provider_usage_source: fields.provider_usage_source ?? null,
    provider_usage_fields_present: fields.provider_usage_fields_present ?? null,
    tokenizer_encoding_used: fields.tokenizer_encoding_used ?? null,
    tokenizer_fallback_reason: fields.tokenizer_fallback_reason ?? null,
    rupiah_cost: fields.rupiah_cost ?? null,
    rupiah_balance_before: fields.rupiah_balance_before ?? null,
    rupiah_balance_after: fields.rupiah_balance_after ?? null,
    freepool_decrement_tokens: fields.freepool_decrement_tokens ?? null,
    freepool_decrement_applied: fields.freepool_decrement_applied ?? null,
    freepool_decrement_reason: fields.freepool_decrement_reason ?? null,
    structured_output_mode: fields.structured_output_mode ?? null,
    validation_result: fields.validation_result ?? null
  }));
}
