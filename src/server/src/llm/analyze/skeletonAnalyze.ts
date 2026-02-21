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
import {
  buildSkeletonAnalyzeInput,
  buildSkeletonParseRepairInput,
  buildSkeletonRepairInput
} from "./skeletonPrompt";
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
    const details = entry.details ? ` details=${JSON.stringify(entry.details)}` : "";
    return `${path}${entry.code} (${entry.message})${details}`;
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
  const extracted = extractFirstJsonObject(text);
  if (!extracted) return null;
  try {
    return JSON.parse(extracted);
  } catch {
    return null;
  }
}

function stripCodeFences(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const withoutOpen = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/, "");
  return withoutOpen.replace(/\s*```$/, "").trim();
}

function extractBalancedObject(value: string): string | null {
  const start = value.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < value.length; i += 1) {
    const char = value[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, i + 1);
      }
    }
  }
  return null;
}

function extractFirstJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const noFence = stripCodeFences(trimmed);
  try {
    JSON.parse(noFence);
    return noFence;
  } catch {
    // continue to extraction fallback
  }
  const balanced = extractBalancedObject(noFence);
  if (!balanced) return null;
  try {
    JSON.parse(balanced);
    return balanced;
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
}): Promise<
  | { ok: true; raw: unknown; usage?: { input_tokens?: number; output_tokens?: number } }
  | { ok: false; code: "parse_error"; error: string; rawText: string; usage?: { input_tokens?: number; output_tokens?: number } }
  | SkeletonAnalyzeErr
> {
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
      rawText: result.text,
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
      if (pass.ok === false) {
        if (pass.code !== "parse_error" || !("rawText" in pass)) return pass;
        usage = pass.usage;
        if (ENABLE_SKELETON_DEBUG_LOGS) {
          console.log(`[skeleton] parse_error attempt=${attempt} raw=${toDebugPreview(pass.rawText)}`);
        }
        if (attempt >= MAX_REPAIR_ATTEMPTS) {
          return {
            ok: false,
            code: "parse_error",
            error: "invalid json after repair attempts",
            validation_result: "failed",
            usage
          };
        }
        currentPrompt = buildSkeletonParseRepairInput({
          text: args.text,
          rawOutputPreview: toDebugPreview(pass.rawText),
          parseError: pass.error,
          lang: args.lang
        });
        attempt += 1;
        continue;
      }
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
        console.log(`[skeleton] raw attempt=${attempt} value=${toDebugPreview(pass.raw)}`);
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

  let currentPrompt = firstInput;
  let attempt = 0;
  let usage: { input_tokens?: number; output_tokens?: number } | undefined;
  while (attempt <= MAX_REPAIR_ATTEMPTS) {
    const result = await args.provider.generateStructuredJson({
      model: args.model,
      input: currentPrompt,
      schema,
      timeoutMs: attempt === 0 ? args.timeoutMs : args.repairTimeoutMs
    });
    if (result.ok === false) {
      return toLlmError(result as LlmError);
    }
    usage = result.usage;
    const validation = validateKnowledgeSkeletonV1(result.json);
    if (validation.ok === true) {
      if (ENABLE_SKELETON_DEBUG_LOGS) {
        console.log(`[skeleton] openai accepted attempt=${attempt} value=${toDebugPreview(validation.value)}`);
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
      console.log(`[skeleton] openai raw attempt=${attempt} value=${toDebugPreview(result.json)}`);
      console.log(`[skeleton] openai invalid attempt=${attempt} errors=${toValidationMessages(validationErrors).join("; ")}`);
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
      invalidJson: toDebugPreview(result.json),
      validationErrors: toValidationMessages(validationErrors),
      lang: args.lang
    });
    attempt += 1;
  }
  return {
    ok: false,
    code: "skeleton_output_invalid",
    error: "structured skeleton output invalid",
    validation_result: "failed",
    usage
  };
}
