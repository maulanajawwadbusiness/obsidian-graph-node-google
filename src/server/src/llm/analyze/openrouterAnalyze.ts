import type { LlmProvider } from "../providers/types";
import type { LlmError } from "../llmClient";
import type { LogicalModel } from "../models/logicalModels";
import { buildAnalyzeJsonSchema, validateAnalyzeJson, type AnalyzeValidationResult } from "./schema";

type OpenrouterAnalyzeOk = {
  ok: true;
  json: unknown;
  usage?: { input_tokens?: number; output_tokens?: number };
  validation_result: "ok" | "retry_ok";
};

type OpenrouterAnalyzeErr = {
  ok: false;
  error: LlmError | { code: "structured_output_invalid"; error: string };
  validation_result: "failed";
};

type OpenrouterAnalyzeResult = OpenrouterAnalyzeOk | OpenrouterAnalyzeErr;

function buildPrompt(schema: object, input: string, errors?: string[]): string {
  const header = [
    "Return ONLY valid JSON that matches the provided JSON Schema.",
    "Do not include backticks or markdown.",
    "If you are unsure, return an empty JSON object {}."
  ];
  if (errors && errors.length > 0) {
    header.push("You returned invalid JSON.");
    header.push(`Validation errors: ${errors.join("; ")}`);
  }
  const body = [
    "JSON Schema:",
    JSON.stringify(schema),
    "",
    "Input:",
    input
  ];
  return [...header, "", ...body].join("\n");
}

function tryParseJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to extraction fallback below.
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = trimmed.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function validateParsed(json: unknown, nodeCount: number): AnalyzeValidationResult {
  return validateAnalyzeJson(json, nodeCount);
}

export async function runOpenrouterAnalyze(opts: {
  provider: LlmProvider;
  model: LogicalModel;
  input: string;
  nodeCount: number;
}): Promise<OpenrouterAnalyzeResult> {
  const schema = buildAnalyzeJsonSchema(opts.nodeCount);
  const firstPrompt = buildPrompt(schema, opts.input);
  const first = await opts.provider.generateText({
    model: opts.model,
    input: firstPrompt
  });

  if (first.ok === false) {
    return { ok: false, error: first, validation_result: "failed" };
  }

  const firstJson = tryParseJson(first.text);
  const firstValidation: AnalyzeValidationResult = firstJson
    ? validateParsed(firstJson, opts.nodeCount)
    : { ok: false, errors: ["invalid json"] };

  if (firstValidation.ok) {
    return { ok: true, json: firstValidation.value, usage: first.usage, validation_result: "ok" };
  }

  let retryErrors: string[] = [];
  if (firstValidation.ok === false) {
    retryErrors = firstValidation.errors;
  }
  const retryPrompt = buildPrompt(schema, opts.input, retryErrors);
  const retry = await opts.provider.generateText({
    model: opts.model,
    input: retryPrompt
  });

  if (retry.ok === false) {
    return { ok: false, error: retry, validation_result: "failed" };
  }

  const retryJson = tryParseJson(retry.text);
  const retryValidation: AnalyzeValidationResult = retryJson
    ? validateParsed(retryJson, opts.nodeCount)
    : { ok: false, errors: ["invalid json"] };

  if (retryValidation.ok) {
    return { ok: true, json: retryValidation.value, usage: retry.usage, validation_result: "retry_ok" };
  }

  return {
    ok: false,
    error: { code: "structured_output_invalid", error: "structured output invalid" },
    validation_result: "failed"
  };
}
