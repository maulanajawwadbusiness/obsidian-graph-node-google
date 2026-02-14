import type express from "express";
import type { LlmError } from "../llm/llmClient";
import type { ProviderUsage } from "../llm/usage/providerUsage";
import type { ValidationError } from "../llm/validate";

export type AuthContext = {
  id: string;
  google_sub: string;
  email?: string | null;
};

export type ApiErrorCode =
  | "bad_request"
  | "too_large"
  | "unauthorized"
  | "insufficient_rupiah"
  | "rate_limited"
  | "upstream_error"
  | "timeout"
  | "parse_error"
  | "structured_output_invalid";

export type ApiError = {
  ok: false;
  request_id: string;
  code: ApiErrorCode;
  error: string;
};

export type LlmRequestLogFields = {
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
};

export type LlmRouteCommonDeps = {
  requireAuth: express.RequestHandler;
  getUserId: (user: AuthContext) => string;
  acquireLlmSlot: (userId: string) => boolean;
  releaseLlmSlot: (userId: string) => void;
  sendApiError: (
    res: express.Response,
    status: number,
    body: ApiError,
    opts?: { headers?: Record<string, string> }
  ) => void;
  isValidationError: (value: unknown) => value is ValidationError;
  logLlmRequest: (fields: LlmRequestLogFields) => void;
  mapLlmErrorToStatus: (error: LlmError) => number;
  mapTerminationReason: (statusCode: number, code?: string) => string;
  getUsageFieldList: (usage: ProviderUsage | null | undefined) => string[];
  getPriceUsdPerM: (model: string) => number | null;
  isDevBalanceBypassEnabled: () => boolean;
  incRequestsTotal: () => void;
  incRequestsInflight: () => void;
  decRequestsInflight: () => void;
};

export type LlmAnalyzeRouteDeps = LlmRouteCommonDeps & {
  isOpenrouterAnalyzeAllowed: (model: string) => boolean;
};

export type LlmPrefillRouteDeps = LlmRouteCommonDeps;

export type LlmChatRouteDeps = LlmRouteCommonDeps & {
  incRequestsStreaming: () => void;
  decRequestsStreaming: () => void;
};
