export type RouterErrorPayload = {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
};

export const ALLOWED_ROUTER_ERROR_CODES = new Set([
  "unauthorized",
  "insufficient_balance",
  "insufficient_rupiah",
  "timeout",
  "MODE_DISABLED",
  "mode_disabled",
  "mode_guard_blocked",
  "validation_error",
  "network_error",
  "analysis_failed",
  "skeleton_analyze_failed",
  "skeleton_output_invalid",
  "parse_error",
  "upstream_error",
  "unknown_error"
]);

function truncateMessage(value: string, maxChars = 240): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 12))} [truncated]`;
}

function resolveAllowedCode(code: unknown, fallbackCode: string): string {
  const candidate = typeof code === "string" ? code.trim() : "";
  if (candidate && ALLOWED_ROUTER_ERROR_CODES.has(candidate)) {
    return candidate;
  }
  return ALLOWED_ROUTER_ERROR_CODES.has(fallbackCode) ? fallbackCode : "unknown_error";
}

export function normalizeRouterErrorPayload(
  error: unknown,
  fallbackCode: string
): RouterErrorPayload {
  if (error instanceof Error) {
    const normalizedMessage = truncateMessage(error.message || String(fallbackCode));
    const messageCodeCandidate = normalizedMessage.toLowerCase().replace(/\s+/g, "_");
    return {
      code: resolveAllowedCode(messageCodeCandidate, fallbackCode),
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
    const allowedCode = code
      ? (ALLOWED_ROUTER_ERROR_CODES.has(code) ? code : "unknown_error")
      : resolveAllowedCode(null, fallbackCode);
    const details =
      code && allowedCode === "unknown_error"
        ? { ...(maybe.details && typeof maybe.details === "object" ? maybe.details as Record<string, unknown> : {}), original_code: code }
        : maybe.details;
    if (code || message || status !== undefined || details !== undefined) {
      const fallbackFromMessage = message ?? allowedCode;
      return {
        code: allowedCode,
        message: truncateMessage(message ?? String(fallbackFromMessage)),
        status,
        details
      };
    }
  }

  const fallbackMessage = truncateMessage(String(error ?? fallbackCode) || String(fallbackCode));
  return {
    code: resolveAllowedCode(null, fallbackCode),
    message: fallbackMessage
  };
}
