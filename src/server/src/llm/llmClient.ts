import crypto from "crypto";

type LlmErrorCode =
  | "bad_request"
  | "unauthorized"
  | "rate_limited"
  | "upstream_error"
  | "timeout"
  | "parse_error";

export type LlmError = {
  ok: false;
  request_id: string;
  code: LlmErrorCode;
  error: string;
  status?: number;
};

export type LlmStructuredOk = {
  ok: true;
  request_id: string;
  json: unknown;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

export type LlmTextOk = {
  ok: true;
  request_id: string;
  text: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

export type LlmStructuredResult = LlmStructuredOk | LlmError;
export type LlmTextResult = LlmTextOk | LlmError;

export type LlmStream = AsyncGenerator<string, void, unknown> & {
  request_id: string;
};

type StructuredOpts = {
  model: string;
  input: string;
  schema: object;
  timeoutMs?: number;
};

type TextOpts = {
  model: string;
  input: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_STREAM_TIMEOUT_MS = 90000;

class LlmStreamError extends Error {
  info: LlmError;
  constructor(info: LlmError) {
    super(info.error);
    this.info = info;
  }
}

function getApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !key.trim()) return null;
  return key.trim();
}

function getBaseUrl(): string {
  return process.env.OPENAI_RESPONSES_URL || "https://api.openai.com/v1/responses";
}

function hasFetch(): boolean {
  return typeof fetch === "function";
}

function mapStatusToCode(status?: number): LlmErrorCode {
  if (!status) return "upstream_error";
  if (status === 400) return "bad_request";
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "unauthorized";
  return "upstream_error";
}

function createError(opts: {
  request_id: string;
  code: LlmErrorCode;
  error: string;
  status?: number;
}): LlmError {
  return {
    ok: false,
    request_id: opts.request_id,
    code: opts.code,
    error: opts.error,
    status: opts.status
  };
}

function buildAbort(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timer };
}

function extractTextFromResponse(data: any): string {
  if (!data) return "";
  if (typeof data.output_text === "string") return data.output_text;

  let content = "";
  const extractText = (obj: any) => {
    if (!obj) return;
    if (typeof obj.text === "string") content += obj.text;
    else if (typeof obj.value === "string") content += obj.value;
    else if (typeof obj.delta === "string") content += obj.delta;
  };

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      extractText(item);
      if (Array.isArray(item?.content)) {
        for (const sub of item.content) extractText(sub);
      }
      if (item?.text && typeof item.text === "object") {
        extractText(item.text);
      }
    }
  }

  return content;
}

function logRequestEnd(fields: {
  request_id: string;
  kind: "structured" | "text" | "stream";
  model: string;
  input_chars: number;
  duration_ms: number;
  status: "ok" | "error";
}) {
  console.log(
    `[llm] request_end request_id=${fields.request_id} kind=${fields.kind} model=${fields.model} input_chars=${fields.input_chars} duration_ms=${fields.duration_ms} status=${fields.status}`
  );
}

export async function generateStructuredJson(opts: StructuredOpts): Promise<LlmStructuredResult> {
  const request_id = crypto.randomUUID();
  const startedAt = Date.now();
  if (!hasFetch()) {
    const err = createError({
      request_id,
      code: "upstream_error",
      error: "fetch not available"
    });
    logRequestEnd({
      request_id,
      kind: "structured",
      model: opts.model,
      input_chars: opts.input.length,
      duration_ms: Date.now() - startedAt,
      status: "error"
    });
    return err;
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = createError({
      request_id,
      code: "unauthorized",
      error: "missing api key"
    });
    logRequestEnd({
      request_id,
      kind: "structured",
      model: opts.model,
      input_chars: opts.input.length,
      duration_ms: Date.now() - startedAt,
      status: "error"
    });
    return err;
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { controller, timer } = buildAbort(timeoutMs);
  try {
    const response = await fetch(getBaseUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: opts.model,
        input: [{ role: "user", content: opts.input }],
        text: {
          format: {
            type: "json_schema",
            name: "structured_response",
            schema: opts.schema,
            strict: true
          }
        },
        store: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const err = createError({
        request_id,
        code: mapStatusToCode(response.status),
        error: `upstream error ${response.status}`,
        status: response.status
      });
      logRequestEnd({
        request_id,
        kind: "structured",
        model: opts.model,
        input_chars: opts.input.length,
        duration_ms: Date.now() - startedAt,
        status: "error"
      });
      return err;
    }

    const data = await response.json();
    const jsonString = extractTextFromResponse(data);
    if (!jsonString) {
      const err = createError({
        request_id,
        code: "parse_error",
        error: "empty structured response"
      });
      logRequestEnd({
        request_id,
        kind: "structured",
        model: opts.model,
        input_chars: opts.input.length,
        duration_ms: Date.now() - startedAt,
        status: "error"
      });
      return err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      const err = createError({
        request_id,
        code: "parse_error",
        error: "failed to parse structured response"
      });
      logRequestEnd({
        request_id,
        kind: "structured",
        model: opts.model,
        input_chars: opts.input.length,
        duration_ms: Date.now() - startedAt,
        status: "error"
      });
      return err;
    }

    logRequestEnd({
      request_id,
      kind: "structured",
      model: opts.model,
      input_chars: opts.input.length,
      duration_ms: Date.now() - startedAt,
      status: "ok"
    });

    return {
      ok: true,
      request_id,
      json: parsed,
      usage: data?.usage
        ? {
            input_tokens: data.usage.input_tokens,
            output_tokens: data.usage.output_tokens
          }
        : undefined
    };
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    const errorResult = createError({
      request_id,
      code: isTimeout ? "timeout" : "upstream_error",
      error: isTimeout ? "timeout" : "request failed"
    });
    logRequestEnd({
      request_id,
      kind: "structured",
      model: opts.model,
      input_chars: opts.input.length,
      duration_ms: Date.now() - startedAt,
      status: "error"
    });
    return errorResult;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateText(opts: TextOpts): Promise<LlmTextResult> {
  const request_id = crypto.randomUUID();
  const startedAt = Date.now();
  if (!hasFetch()) {
    const err = createError({
      request_id,
      code: "upstream_error",
      error: "fetch not available"
    });
    logRequestEnd({
      request_id,
      kind: "text",
      model: opts.model,
      input_chars: opts.input.length,
      duration_ms: Date.now() - startedAt,
      status: "error"
    });
    return err;
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = createError({
      request_id,
      code: "unauthorized",
      error: "missing api key"
    });
    logRequestEnd({
      request_id,
      kind: "text",
      model: opts.model,
      input_chars: opts.input.length,
      duration_ms: Date.now() - startedAt,
      status: "error"
    });
    return err;
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { controller, timer } = buildAbort(timeoutMs);
  try {
    const response = await fetch(getBaseUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: opts.model,
        input: [{ role: "user", content: opts.input }],
        store: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const err = createError({
        request_id,
        code: mapStatusToCode(response.status),
        error: `upstream error ${response.status}`,
        status: response.status
      });
      logRequestEnd({
        request_id,
        kind: "text",
        model: opts.model,
        input_chars: opts.input.length,
        duration_ms: Date.now() - startedAt,
        status: "error"
      });
      return err;
    }

    const data = await response.json();
    const text = extractTextFromResponse(data);
    if (!text) {
      const err = createError({
        request_id,
        code: "parse_error",
        error: "empty response"
      });
      logRequestEnd({
        request_id,
        kind: "text",
        model: opts.model,
        input_chars: opts.input.length,
        duration_ms: Date.now() - startedAt,
        status: "error"
      });
      return err;
    }

    logRequestEnd({
      request_id,
      kind: "text",
      model: opts.model,
      input_chars: opts.input.length,
      duration_ms: Date.now() - startedAt,
      status: "ok"
    });

    return {
      ok: true,
      request_id,
      text,
      usage: data?.usage
        ? {
            input_tokens: data.usage.input_tokens,
            output_tokens: data.usage.output_tokens
          }
        : undefined
    };
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    const errorResult = createError({
      request_id,
      code: isTimeout ? "timeout" : "upstream_error",
      error: isTimeout ? "timeout" : "request failed"
    });
    logRequestEnd({
      request_id,
      kind: "text",
      model: opts.model,
      input_chars: opts.input.length,
      duration_ms: Date.now() - startedAt,
      status: "error"
    });
    return errorResult;
  } finally {
    clearTimeout(timer);
  }
}

export function generateTextStream(opts: TextOpts): LlmStream {
  const request_id = crypto.randomUUID();
  const apiKey = getApiKey();
  const startedAt = Date.now();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS;
  let finalStatus: "ok" | "error" = "ok";

  const stream = (async function* () {
    if (!hasFetch()) {
      finalStatus = "error";
      const err = createError({
        request_id,
        code: "upstream_error",
        error: "fetch not available"
      });
      throw new LlmStreamError(err);
    }
    if (!apiKey) {
      finalStatus = "error";
      const err = createError({
        request_id,
        code: "unauthorized",
        error: "missing api key"
      });
      throw new LlmStreamError(err);
    }

    const { controller, timer } = buildAbort(timeoutMs);
    try {
      const response = await fetch(getBaseUrl(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: opts.model,
          input: [{ role: "user", content: opts.input }],
          stream: true,
          store: false
        }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        finalStatus = "error";
        const err = createError({
          request_id,
          code: mapStatusToCode(response.status),
          error: `upstream error ${response.status}`,
          status: response.status
        });
        throw new LlmStreamError(err);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split("\n\n");
          buffer = frames.pop() || "";

          for (const frame of frames) {
            const lines = frame.split("\n");
            let dataBuffer = "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                dataBuffer += trimmed.slice(6);
              }
            }

            if (!dataBuffer) continue;
            if (dataBuffer === "[DONE]") return;

            try {
              const event = JSON.parse(dataBuffer);
              if (event?.type === "response.output_text.delta") {
                const delta = typeof event.delta === "string" ? event.delta : "";
                if (delta) yield delta;
              }
            } catch {
              // Ignore parse errors for non-json frames
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      finalStatus = "error";
      if (err instanceof LlmStreamError) throw err;
      const errorResult = createError({
        request_id,
        code: isTimeout ? "timeout" : "upstream_error",
        error: isTimeout ? "timeout" : "request failed"
      });
      throw new LlmStreamError(errorResult);
    } finally {
      clearTimeout(timer);
      logRequestEnd({
        request_id,
        kind: "stream",
        model: opts.model,
        input_chars: opts.input.length,
        duration_ms: Date.now() - startedAt,
        status: finalStatus
      });
    }
  })();

  (stream as LlmStream).request_id = request_id;
  return stream as LlmStream;
}
