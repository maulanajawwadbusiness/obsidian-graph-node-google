export type RouterErrorPayload = {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
};

export function normalizeRouterErrorPayload(
  error: unknown,
  fallbackCode: string
): RouterErrorPayload {
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

  if (error instanceof Error) {
    const normalizedMessage = error.message.trim() || String(fallbackCode);
    return {
      code: normalizedMessage,
      message: normalizedMessage
    };
  }

  const fallbackMessage = String(error ?? fallbackCode).trim() || String(fallbackCode);
  return {
    code: fallbackCode,
    message: fallbackMessage
  };
}
