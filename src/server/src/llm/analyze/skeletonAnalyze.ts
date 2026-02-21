import type { LlmProvider } from "../providers/types";
import type { LogicalModel } from "../models/logicalModels";
import type { LlmError } from "../llmClient";
import {
  buildKnowledgeSkeletonV1JsonSchema,
  type KnowledgeSkeletonV1,
  validateKnowledgeSkeletonV1,
  type KnowledgeSkeletonValidationError
} from "./knowledgeSkeletonV1";
import {
  buildSkeletonAnalyzeInput,
  buildSkeletonParseRepairInput,
  buildSkeletonRepairInput,
  SKELETON_PROMPT_LIMITS,
  trimWithHeadTail
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
const MAX_PARSE_REPAIR_ATTEMPTS = 1;
const MAX_SEMANTIC_REPAIR_ATTEMPTS = 2;
const MAX_REPAIR_ERRORS_INCLUDED = 20;
const MAX_TOTAL_MODEL_CALLS = 3;

function compareCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function getValidationPriority(error: KnowledgeSkeletonValidationError): number {
  switch (error.code) {
    case "orphan_nodes_excessive":
      return 0;
    case "edge_from_missing_node":
    case "edge_to_missing_node":
      return 1;
    case "duplicate_edge_semantic":
      return 2;
    case "edge_count_out_of_range":
      return 3;
    case "unknown_property":
      return 4;
    default:
      return 10;
  }
}

function formatValidationEntry(error: KnowledgeSkeletonValidationError): string {
  const path = error.path ?? "";
  const details = error.details ? JSON.stringify(error.details) : "";
  return `code=${error.code} path=${path} message=${error.message} details=${details}`;
}

function toValidationMessages(errors: KnowledgeSkeletonValidationError[]): string[] {
  return errors.map((entry) => {
    const path = entry.path ? `${entry.path}: ` : "";
    const details = entry.details ? ` details=${JSON.stringify(entry.details)}` : "";
    return `${path}${entry.code} (${entry.message})${details}`;
  });
}

export function summarizeValidationErrorsForRepair(
  errors: KnowledgeSkeletonValidationError[]
): { lines: string[]; truncatedCount: number } {
  const ranked = [...errors].sort((a, b) => {
    const priorityDelta = getValidationPriority(a) - getValidationPriority(b);
    if (priorityDelta !== 0) return priorityDelta;
    const pathCompare = compareCodeUnit(a.path ?? "", b.path ?? "");
    if (pathCompare !== 0) return pathCompare;
    const codeCompare = compareCodeUnit(a.code, b.code);
    if (codeCompare !== 0) return codeCompare;
    return compareCodeUnit(a.message, b.message);
  });
  const limited = ranked.slice(0, MAX_REPAIR_ERRORS_INCLUDED);
  const truncatedCount = Math.max(0, ranked.length - limited.length);
  const lines = limited.map(formatValidationEntry);
  if (truncatedCount > 0) {
    lines.push(`+${truncatedCount} more errors truncated`);
  }
  return { lines, truncatedCount };
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

export function toRawPreviewForLogs(value: unknown): string {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return trimWithHeadTail(text, SKELETON_PROMPT_LIMITS.repairRawOutputPreviewMaxChars);
  } catch {
    return "<unserializable>";
  }
}

export function toRepairContext(value: unknown): string {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return trimWithHeadTail(text, SKELETON_PROMPT_LIMITS.repairInvalidJsonMaxChars);
  } catch {
    return "<unserializable>";
  }
}

function toSkeletonSummary(value: KnowledgeSkeletonV1): string {
  const topNode = [...value.nodes].sort((a, b) => b.pressure - a.pressure)[0];
  return `nodes=${value.nodes.length} edges=${value.edges.length} top_pressure_id=${topNode?.id ?? "none"}`;
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
    let parseRepairsUsed = 0;
    let semanticRepairsUsed = 0;
    let totalModelCalls = 0;
    while (true) {
      if (totalModelCalls >= MAX_TOTAL_MODEL_CALLS) {
        return {
          ok: false,
          code: "skeleton_output_invalid",
          error: "model call cap exceeded before valid skeleton output",
          validation_result: "failed",
          usage
        };
      }
      const pass = await runOpenrouterSkeletonPass({
        provider: args.provider,
        model: args.model,
        text: args.text,
        lang: args.lang,
        timeoutMs: parseRepairsUsed + semanticRepairsUsed === 0 ? args.timeoutMs : args.repairTimeoutMs,
        prompt: currentPrompt
      });
      totalModelCalls += 1;
      if (pass.ok === false) {
        if (pass.code !== "parse_error" || !("rawText" in pass)) return pass;
        usage = pass.usage;
        if (ENABLE_SKELETON_DEBUG_LOGS) {
          console.log(`[skeleton] parse_error parse_retries=${parseRepairsUsed} raw=${toRawPreviewForLogs(pass.rawText)}`);
        }
        if (parseRepairsUsed >= MAX_PARSE_REPAIR_ATTEMPTS || totalModelCalls >= MAX_TOTAL_MODEL_CALLS) {
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
          rawOutputContext: toRepairContext(pass.rawText),
          parseError: pass.error,
          lang: args.lang
        });
        parseRepairsUsed += 1;
        continue;
      }
      usage = pass.usage;
      const validation = validateKnowledgeSkeletonV1(pass.raw);
      if (validation.ok === true) {
        if (ENABLE_SKELETON_DEBUG_LOGS) {
          console.log(
            `[skeleton] accepted parse_retries=${parseRepairsUsed} semantic_retries=${semanticRepairsUsed} ` +
            `${toSkeletonSummary(validation.value)}`
          );
        }
        return {
          ok: true,
          value: validation.value,
          validation_result: parseRepairsUsed + semanticRepairsUsed > 0 ? "retry_ok" : "ok",
          usage
        };
      }
      const validationErrors = validation.errors;
      const repairSummary = summarizeValidationErrorsForRepair(validationErrors);
      if (ENABLE_SKELETON_DEBUG_LOGS) {
        console.log(
          `[skeleton] raw parse_retries=${parseRepairsUsed} semantic_retries=${semanticRepairsUsed} ` +
          `value=${toRawPreviewForLogs(pass.raw)}`
        );
        console.log(
          `[skeleton] invalid semantic_retries=${semanticRepairsUsed} ` +
          `errors=${toValidationMessages(validationErrors).join("; ")}`
        );
      }
      const maxSemanticRepairsForPath = parseRepairsUsed > 0 ? 1 : MAX_SEMANTIC_REPAIR_ATTEMPTS;
      if (semanticRepairsUsed >= maxSemanticRepairsForPath || totalModelCalls >= MAX_TOTAL_MODEL_CALLS) {
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
        invalidJson: toRepairContext(pass.raw),
        validationErrors: repairSummary.lines,
        lang: args.lang
      });
      semanticRepairsUsed += 1;
    }
  }

  let currentPrompt = firstInput;
  let semanticRepairsUsed = 0;
  let usage: { input_tokens?: number; output_tokens?: number } | undefined;
  let totalModelCalls = 0;
  while (true) {
    if (totalModelCalls >= MAX_TOTAL_MODEL_CALLS) {
      return {
        ok: false,
        code: "skeleton_output_invalid",
        error: "model call cap exceeded before valid skeleton output",
        validation_result: "failed",
        usage
      };
    }
    const result = await args.provider.generateStructuredJson({
      model: args.model,
      input: currentPrompt,
      schema,
      timeoutMs: semanticRepairsUsed === 0 ? args.timeoutMs : args.repairTimeoutMs
    });
    totalModelCalls += 1;
    if (result.ok === false) {
      return toLlmError(result as LlmError);
    }
    usage = result.usage;
    const validation = validateKnowledgeSkeletonV1(result.json);
    if (validation.ok === true) {
      if (ENABLE_SKELETON_DEBUG_LOGS) {
        console.log(`[skeleton] openai accepted semantic_retries=${semanticRepairsUsed} ${toSkeletonSummary(validation.value)}`);
      }
      return {
        ok: true,
        value: validation.value,
        validation_result: semanticRepairsUsed > 0 ? "retry_ok" : "ok",
        usage
      };
    }
    const validationErrors = validation.errors;
    const repairSummary = summarizeValidationErrorsForRepair(validationErrors);
    if (ENABLE_SKELETON_DEBUG_LOGS) {
      console.log(`[skeleton] openai raw semantic_retries=${semanticRepairsUsed} value=${toRawPreviewForLogs(result.json)}`);
      console.log(
        `[skeleton] openai invalid semantic_retries=${semanticRepairsUsed} ` +
        `errors=${toValidationMessages(validationErrors).join("; ")}`
      );
    }
    if (semanticRepairsUsed >= MAX_SEMANTIC_REPAIR_ATTEMPTS || totalModelCalls >= MAX_TOTAL_MODEL_CALLS) {
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
      invalidJson: toRepairContext(result.json),
      validationErrors: repairSummary.lines,
      lang: args.lang
    });
    semanticRepairsUsed += 1;
  }
}
