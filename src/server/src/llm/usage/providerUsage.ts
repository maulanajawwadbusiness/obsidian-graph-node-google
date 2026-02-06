export type ProviderUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

function toInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  return Math.trunc(value);
}

export function normalizeUsage(raw: any): ProviderUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const input = toInt(raw.input_tokens ?? raw.prompt_tokens ?? raw.inputTokens);
  const output = toInt(raw.output_tokens ?? raw.completion_tokens ?? raw.outputTokens);
  const total = toInt(raw.total_tokens ?? raw.totalTokens);

  const hasAny = input !== null || output !== null || total !== null;
  if (!hasAny) return null;

  const normalized: ProviderUsage = {};
  if (input !== null) normalized.input_tokens = input;
  if (output !== null) normalized.output_tokens = output;

  if (total !== null) {
    normalized.total_tokens = total;
  } else if (input !== null || output !== null) {
    normalized.total_tokens = (input || 0) + (output || 0);
  }

  return normalized;
}

export function mergeUsage(preferred: ProviderUsage | null, fallback: ProviderUsage | null): ProviderUsage | null {
  if (preferred && (preferred.input_tokens !== undefined || preferred.output_tokens !== undefined || preferred.total_tokens !== undefined)) {
    return preferred;
  }
  return fallback;
}
