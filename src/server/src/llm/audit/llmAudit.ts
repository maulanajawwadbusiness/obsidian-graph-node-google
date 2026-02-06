import { getPool } from "../../db";

export type LlmAuditRecord = {
  request_id: string;
  user_id: string;
  endpoint_kind: string;
  selected_provider: string;
  actual_provider_used: string;
  logical_model: string;
  provider_model_id: string;
  usage_source: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  tokenizer_encoding_used?: string | null;
  tokenizer_fallback_reason?: string | null;
  provider_usage_present: boolean;
  fx_usd_idr?: number | null;
  price_usd_per_mtoken?: number | null;
  markup_multiplier: number;
  cost_idr: number;
  balance_before_idr?: number | null;
  balance_after_idr?: number | null;
  charge_status: string;
  charge_error_code?: string | null;
  freepool_applied: boolean;
  freepool_decrement_tokens: number;
  freepool_reason?: string | null;
  http_status?: number | null;
  termination_reason?: string | null;
};

export async function upsertAuditRecord(record: LlmAuditRecord): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `insert into llm_request_audit
      (request_id, user_id, endpoint_kind, selected_provider, actual_provider_used,
       logical_model, provider_model_id, usage_source, input_tokens, output_tokens, total_tokens,
       tokenizer_encoding_used, tokenizer_fallback_reason, provider_usage_present,
       fx_usd_idr, price_usd_per_mtoken, markup_multiplier, cost_idr,
       balance_before_idr, balance_after_idr, charge_status, charge_error_code,
       freepool_applied, freepool_decrement_tokens, freepool_reason, http_status, termination_reason)
     values
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
     on conflict (request_id) do update set
       user_id = excluded.user_id,
       endpoint_kind = excluded.endpoint_kind,
       selected_provider = excluded.selected_provider,
       actual_provider_used = excluded.actual_provider_used,
       logical_model = excluded.logical_model,
       provider_model_id = excluded.provider_model_id,
       usage_source = excluded.usage_source,
       input_tokens = excluded.input_tokens,
       output_tokens = excluded.output_tokens,
       total_tokens = excluded.total_tokens,
       tokenizer_encoding_used = excluded.tokenizer_encoding_used,
       tokenizer_fallback_reason = excluded.tokenizer_fallback_reason,
       provider_usage_present = excluded.provider_usage_present,
       fx_usd_idr = excluded.fx_usd_idr,
       price_usd_per_mtoken = excluded.price_usd_per_mtoken,
       markup_multiplier = excluded.markup_multiplier,
       cost_idr = excluded.cost_idr,
       balance_before_idr = excluded.balance_before_idr,
       balance_after_idr = excluded.balance_after_idr,
       charge_status = excluded.charge_status,
       charge_error_code = excluded.charge_error_code,
       freepool_applied = excluded.freepool_applied,
       freepool_decrement_tokens = excluded.freepool_decrement_tokens,
       freepool_reason = excluded.freepool_reason,
       http_status = excluded.http_status,
       termination_reason = excluded.termination_reason`,
    [
      record.request_id,
      record.user_id,
      record.endpoint_kind,
      record.selected_provider,
      record.actual_provider_used,
      record.logical_model,
      record.provider_model_id,
      record.usage_source,
      record.input_tokens,
      record.output_tokens,
      record.total_tokens,
      record.tokenizer_encoding_used ?? null,
      record.tokenizer_fallback_reason ?? null,
      record.provider_usage_present,
      record.fx_usd_idr ?? null,
      record.price_usd_per_mtoken ?? null,
      record.markup_multiplier,
      record.cost_idr,
      record.balance_before_idr ?? null,
      record.balance_after_idr ?? null,
      record.charge_status,
      record.charge_error_code ?? null,
      record.freepool_applied,
      record.freepool_decrement_tokens,
      record.freepool_reason ?? null,
      record.http_status ?? null,
      record.termination_reason ?? null
    ]
  );
}
