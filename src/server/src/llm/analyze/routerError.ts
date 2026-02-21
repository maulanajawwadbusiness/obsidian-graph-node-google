export type RouterErrorPayload = {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
};

const KNOWN_ERROR_CODES = new Set([
  "unauthorized",
  "insufficient_balance",
  "timeout",
  "mode_disabled",
  "mode_guard_blocked",
  "analysis_failed",
  "skeleton_analyze_failed",
  "skeleton_output_invalid",
  "parse_error",
  "upstream_error"
]);

function truncateMessage(value: string, maxChars = 240): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 12))} [truncated]`;
}

export function normalizeRouterErrorPayload(
  error: unknown,
  fallbackCode: string
): RouterErrorPayload {
  if (error instanceof Error) {
    const normalizedMessage = truncateMessage(error.message || String(fallbackCode));
    const normalizedCodeCandidate = normalizedMessage.toLowerCase().replace(/\s+/g, "_");
    const code = KNOWN_ERROR_CODES.has(normalizedCodeCandidate) ? normalizedCodeCandidate : "unknown_error";
    return {
      code,
      message: normalizedMessage
    };
  }

  if (error && typeof error === "object") {
    const maybe = error as {
      code?: unknown;
      message?: unknown;
      status?: unknown;
      details?: unknown;
    };
    const code = typeof maybe.code === "string" && maybe.code.trim() ? maybe.code : null;
    const message = typeof maybe.message === "string" && maybe.message.trim() ? maybe.message : null;
    const status = typeof maybe.status === "number" && Number.isFinite(maybe.status) ? maybe.status : undefined;
    const details = maybe.details;
    if (code || message || status !== undefined || details !== undefined) {
      const fallbackFromMessage = message ?? fallbackCode;
      return {
        code: code ?? fallbackFromMessage,
        message: message ?? String(code ?? fallbackFromMessage),
        status,
        details
      };
    }
  }

  const fallbackMessage = truncateMessage(String(error ?? fallbackCode) || String(fallbackCode));
  return {
    code: KNOWN_ERROR_CODES.has(fallbackCode) ? fallbackCode : "unknown_error",
    message: fallbackMessage
  };
}
