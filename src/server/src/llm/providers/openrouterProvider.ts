import crypto from "crypto";
import type { LlmProvider } from "./types";
import type { LlmError, LlmStream, LlmStructuredResult, LlmTextResult } from "../llmClient";

type TextOpts = {
  model: string;
  input: string;
  timeoutMs?: number;
};

type StructuredOpts = {
  model: string;
  input: string;
  schema: object;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_STREAM_TIMEOUT_MS = 90000;

class OpenRouterStreamError extends Error {
  info: LlmError;
  constructor(info: LlmError) {
    super(info.error);
    this.info = info;
  }
}

function getApiKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !key.trim()) return null;
  return key.trim();
}

function getBaseUrl(): string {
  return process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
}

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
  const referer = process.env.OPENROUTER_HTTP_REFERER;
  const title = process.env.OPENROUTER_X_TITLE;
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;
  return headers;
}

function mapStatusToCode(status?: number): LlmError["code"] {
  if (!status) return "upstream_error";
  if (status === 400) return "bad_request";
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "unauthorized";
  return "upstream_error";
}

function createError(opts: {
  request_id: string;
  code: LlmError["code"];
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

function extractTextFromChatCompletion(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  return "";
}

function extractUsage(data: any) {
  if (!data?.usage) return undefined;
  const promptTokens = Number(data.usage.prompt_tokens);
  const completionTokens = Number(data.usage.completion_tokens);
  return {
    input_tokens: Number.isFinite(promptTokens) ? promptTokens : undefined,
    output_tokens: Number.isFinite(completionTokens) ? completionTokens : undefined
  };
}

async function postJson(path: string, body: object, timeoutMs: number) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: "missing api key" as const };
  }
  const { controller, timer } = buildAbort(timeoutMs);
  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal
    });
    return { ok: true as const, response };
  } finally {
    clearTimeout(timer);
  }
}

async function generateText(opts: TextOpts): Promise<LlmTextResult> {
  const request_id = crypto.randomUUID();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const result = await postJson(
    "/chat/completions",
    {
      model: opts.model,
      messages: [{ role: "user", content: opts.input }],
      stream: false
    },
    timeoutMs
  );
  if (!result.ok) {
    return createError({
      request_id,
      code: "unauthorized",
      error: result.error
    });
  }
  const response = result.response;
  if (!response.ok) {
    return createError({
      request_id,
      code: mapStatusToCode(response.status),
      error: `upstream error ${response.status}`,
      status: response.status
    });
  }
  const data = await response.json();
  if (data?.error) {
    return createError({
      request_id,
      code: "upstream_error",
      error: "upstream error"
    });
  }
  const text = extractTextFromChatCompletion(data);
  if (!text) {
    return createError({
      request_id,
      code: "parse_error",
      error: "empty response"
    });
  }
  return { ok: true, request_id, text, usage: extractUsage(data) };
}

async function generateStructuredJson(opts: StructuredOpts): Promise<LlmStructuredResult> {
  const request_id = crypto.randomUUID();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const systemPrompt = [
    "Return ONLY valid JSON that matches the provided JSON Schema.",
    "Do not include backticks or markdown.",
    "If you are unsure, return an empty JSON object {}."
  ].join("\n");
  const userPrompt = [
    "JSON Schema:",
    JSON.stringify(opts.schema),
    "",
    "Input:",
    opts.input
  ].join("\n");
  const result = await postJson(
    "/chat/completions",
    {
      model: opts.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      stream: false
    },
    timeoutMs
  );
  if (!result.ok) {
    return createError({
      request_id,
      code: "unauthorized",
      error: result.error
    });
  }
  const response = result.response;
  if (!response.ok) {
    return createError({
      request_id,
      code: mapStatusToCode(response.status),
      error: `upstream error ${response.status}`,
      status: response.status
    });
  }
  const data = await response.json();
  if (data?.error) {
    return createError({
      request_id,
      code: "upstream_error",
      error: "upstream error"
    });
  }
  const text = extractTextFromChatCompletion(data);
  if (!text) {
    return createError({
      request_id,
      code: "parse_error",
      error: "empty structured response"
    });
  }
  try {
    const json = JSON.parse(text);
    return { ok: true, request_id, json, usage: extractUsage(data) };
  } catch {
    return createError({
      request_id,
      code: "parse_error",
      error: "failed to parse structured response"
    });
  }
}

function generateTextStream(opts: TextOpts): LlmStream {
  const request_id = crypto.randomUUID();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS;
  let finalStatus: "ok" | "error" = "ok";

  const stream = (async function* () {
    const apiKey = getApiKey();
    if (!apiKey) {
      finalStatus = "error";
      throw new OpenRouterStreamError(createError({
        request_id,
        code: "unauthorized",
        error: "missing api key"
      }));
    }

    const { controller, timer } = buildAbort(timeoutMs);
    try {
      const response = await fetch(`${getBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          model: opts.model,
          messages: [{ role: "user", content: opts.input }],
          stream: true
        }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        finalStatus = "error";
        throw new OpenRouterStreamError(createError({
          request_id,
          code: mapStatusToCode(response.status),
          error: `upstream error ${response.status}`,
          status: response.status
        }));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let yieldedAny = false;

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

            let event: any;
            try {
              event = JSON.parse(dataBuffer);
            } catch {
              continue;
            }

            if (event?.error) {
              finalStatus = "error";
              if (!yieldedAny) {
                throw new OpenRouterStreamError(createError({
                  request_id,
                  code: "upstream_error",
                  error: "upstream error"
                }));
              }
              return;
            }

            const delta = event?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              yieldedAny = true;
              yield delta;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      finalStatus = "error";
      if (err instanceof OpenRouterStreamError) throw err;
      throw new OpenRouterStreamError(createError({
        request_id,
        code: isTimeout ? "timeout" : "upstream_error",
        error: isTimeout ? "timeout" : "request failed"
      }));
    } finally {
      clearTimeout(timer);
    }
  })();

  (stream as LlmStream).request_id = request_id;
  return stream as LlmStream;
}

export const openrouterProvider: LlmProvider = {
  name: "openrouter",
  generateText,
  generateTextStream,
  generateStructuredJson
};
