import type { LlmProvider } from "../providers/types";
import type { LogicalModel } from "../models/logicalModels";
import type { LlmError } from "../llmClient";
import {
  buildKnowledgeSkeletonV1JsonSchema,
  type KnowledgeSkeletonV1,
  SKELETON_V1_LIMITS,
  validateKnowledgeSkeletonV1,
  type KnowledgeSkeletonValidationError
} from "./knowledgeSkeletonV1";
import { buildSkeletonAnalyzeInput, buildSkeletonRepairInput } from "./skeletonPrompt";
import type { AnalyzePromptLang } from "./prompt";

type SkeletonAnalyzeOk = {
  ok: true;
  value: KnowledgeSkeletonV1;
  validation_result: "ok" | "retry_ok";
  usage?: { input_tokens?: number; output_tokens?: number };
};

type SkeletonAnalyzeErr = {
  ok: false;
  code: "skeleton_output_invalid" | "parse_error" | "upstream_error" | "timeout";
  error: string;
  validation_result: "failed";
  errors?: KnowledgeSkeletonValidationError[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

export type SkeletonAnalyzeResult = SkeletonAnalyzeOk | SkeletonAnalyzeErr;

const ENABLE_SKELETON_DEBUG_LOGS = false;
const MAX_REPAIR_ATTEMPTS = 2;

function toValidationMessages(errors: KnowledgeSkeletonValidationError[]): string[] {
  return errors.map((entry) => {
    const path = entry.path ? `${entry.path}: ` : "";
    return `${path}${entry.code} (${entry.message})`;
  });
}

function toLlmError(result: { code: string; error: string }): SkeletonAnalyzeErr {
  const normalizedCode = result.code === "timeout" ? "timeout" : "upstream_error";
  return {
    ok: false,
    code: normalizedCode,
    error: result.error,
    validation_result: "failed"
  };
}

function tryParseJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to extraction fallback
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

function toDebugPreview(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    if (json.length <= SKELETON_V1_LIMITS.maxRawModelJsonChars) return json;
    return `${json.slice(0, SKELETON_V1_LIMITS.maxRawModelJsonChars)}...(truncated)`;
  } catch {
    return "<unserializable>";
  }
}

async function runOpenrouterSkeletonPass(args: {
  provider: LlmProvider;
  model: LogicalModel;
  text: string;
  lang?: AnalyzePromptLang;
  timeoutMs?: number;
  prompt: string;
}): Promise<{ ok: true; raw: unknown; usage?: { input_tokens?: number; output_tokens?: number } } | SkeletonAnalyzeErr> {
  const result = await args.provider.generateText({
    model: args.model,
    input: args.prompt,
    timeoutMs: args.timeoutMs
  });
  if (result.ok === false) {
    return toLlmError(result as LlmError);
  }
  const parsed = tryParseJson(result.text);
  if (!parsed) {
    return {
      ok: false,
      code: "parse_error",
      error: "invalid json",
      validation_result: "failed",
      usage: result.usage
    };
  }
  return { ok: true, raw: parsed, usage: result.usage };
}

export async function analyzeDocumentToSkeletonV1(args: {
  provider: LlmProvider;
  model: LogicalModel;
  text: string;
  lang?: AnalyzePromptLang;
  timeoutMs?: number;
  repairTimeoutMs?: number;
}): Promise<SkeletonAnalyzeResult> {
  const schema = buildKnowledgeSkeletonV1JsonSchema();
  const firstInput = buildSkeletonAnalyzeInput({ text: args.text, lang: args.lang });

  if (args.provider.name === "openrouter") {
    let usage: { input_tokens?: number; output_tokens?: number } | undefined;
    let currentPrompt = firstInput;
    let attempt = 0;
    while (attempt <= MAX_REPAIR_ATTEMPTS) {
      const pass = await runOpenrouterSkeletonPass({
        provider: args.provider,
        model: args.model,
        text: args.text,
        lang: args.lang,
        timeoutMs: attempt === 0 ? args.timeoutMs : args.repairTimeoutMs,
        prompt: currentPrompt
      });
      if (pass.ok === false) return pass;
      usage = pass.usage;
      const validation = validateKnowledgeSkeletonV1(pass.raw);
      if (validation.ok === true) {
        if (ENABLE_SKELETON_DEBUG_LOGS) {
          console.log(`[skeleton] accepted attempt=${attempt} value=${toDebugPreview(validation.value)}`);
        }
        return {
          ok: true,
          value: validation.value,
          validation_result: attempt === 0 ? "ok" : "retry_ok",
          usage
        };
      }
      const validationErrors = validation.errors;
      if (ENABLE_SKELETON_DEBUG_LOGS) {
        console.log(`[skeleton] invalid attempt=${attempt} errors=${toValidationMessages(validationErrors).join("; ")}`);
      }
      if (attempt >= MAX_REPAIR_ATTEMPTS) {
        return {
          ok: false,
          code: "skeleton_output_invalid",
          error: "structured skeleton output invalid",
          validation_result: "failed",
          errors: validationErrors,
          usage
        };
      }
      currentPrompt = buildSkeletonRepairInput({
        text: args.text,
        invalidJson: toDebugPreview(pass.raw),
        validationErrors: toValidationMessages(validationErrors),
        lang: args.lang
      });
      attempt += 1;
    }
    return {
      ok: false,
      code: "skeleton_output_invalid",
      error: "structured skeleton output invalid",
      validation_result: "failed"
    };
  }

  const result = await args.provider.generateStructuredJson({
    model: args.model,
    input: firstInput,
    schema,
    timeoutMs: args.timeoutMs
  });
  if (result.ok === false) {
    return toLlmError(result as LlmError);
  }
  const validation = validateKnowledgeSkeletonV1(result.json);
  if (validation.ok === false) {
    const validationErrors = validation.errors;
    if (ENABLE_SKELETON_DEBUG_LOGS) {
      console.log(`[skeleton] openai invalid errors=${toValidationMessages(validationErrors).join("; ")}`);
    }
    return {
      ok: false,
      code: "skeleton_output_invalid",
      error: "structured skeleton output invalid",
      validation_result: "failed",
      errors: validationErrors,
      usage: result.usage
    };
  }
  if (ENABLE_SKELETON_DEBUG_LOGS) {
    console.log(`[skeleton] openai accepted value=${toDebugPreview(validation.value)}`);
  }
  return { ok: true, value: validation.value, validation_result: "ok", usage: result.usage };
}
