import {
  SKELETON_EDGE_TYPES,
  SKELETON_NODE_ROLES,
  SKELETON_V1_LIMITS
} from "./knowledgeSkeletonV1";
import type { AnalyzePromptLang } from "./prompt";

type SkeletonPromptOpts = {
  text: string;
  lang?: AnalyzePromptLang;
};

export const SKELETON_PROMPT_LIMITS = {
  repairInvalidJsonMaxChars: 8000,
  repairRawOutputPreviewMaxChars: 2000,
  repairDocumentExcerptMaxChars: 3000
} as const;

function getLanguageDirective(lang: AnalyzePromptLang): string {
  if (lang === "id") {
    return "LANGUAGE DIRECTIVE: Write label, summary, and rationale in Bahasa Indonesia.";
  }
  return "LANGUAGE DIRECTIVE: Write label, summary, and rationale in English.";
}

function clampNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function trimWithHeadTail(value: string, maxChars: number): string {
  const normalized = value.trim();
  const limit = clampNonNegativeInteger(maxChars);
  if (limit <= 0) return "";
  if (normalized.length <= limit) return normalized;
  const marker = "\n...[truncated]...\n";
  if (limit <= marker.length + 2) {
    return `${normalized.slice(0, limit)}...[truncated]`;
  }
  const keep = limit - marker.length;
  const headLen = Math.ceil(keep / 2);
  const tailLen = Math.floor(keep / 2);
  const head = normalized.slice(0, headLen);
  const tail = normalized.slice(Math.max(normalized.length - tailLen, 0));
  return `${head}${marker}${tail}`;
}

function buildCoreInstruction(lang: AnalyzePromptLang): string {
  return [
    "You are Arnvoid knowledge skeleton analyzer.",
    "Return JSON only, no markdown and no extra prose.",
    "",
    "Required output shape:",
    "- nodes: array length 3..12",
    "- edges: array of directed relations",
    "",
    `Allowed node roles: ${SKELETON_NODE_ROLES.join(", ")}`,
    `Allowed edge types: ${SKELETON_EDGE_TYPES.join(", ")}`,
    "",
    "Node constraints:",
    "- id must be short slug-like string: lowercase letters, numbers, hyphen only.",
    `- label max ${SKELETON_V1_LIMITS.maxLabelChars} chars.`,
    `- summary max ${SKELETON_V1_LIMITS.maxSummaryChars} chars.`,
    "- pressure and confidence must be numbers in [0,1].",
    "",
    "Edge constraints:",
    "- from and to must reference existing node ids.",
    "- no self loops.",
    `- rationale max ${SKELETON_V1_LIMITS.maxRationaleChars} chars.`,
    "- weight must be number in [0,1].",
    "",
    "Graph constraints:",
    "- No orphan nodes: every node must have degree >= 1 (incoming or outgoing).",
    "- Edge cap rule: edges must satisfy edges <= max(6, nodeCount * 2).",
    "- Keep graph glance-readable and avoid edge spam.",
    "",
    getLanguageDirective(lang)
  ].join("\n");
}

export function buildSkeletonAnalyzeInput(opts: SkeletonPromptOpts): string {
  const lang: AnalyzePromptLang = opts.lang === "en" ? "en" : "id";
  const excerpt = trimWithHeadTail(opts.text, SKELETON_PROMPT_LIMITS.repairDocumentExcerptMaxChars);
  return [
    buildCoreInstruction(lang),
    "",
    "Document excerpt:",
    `\"\"\"${excerpt}\"\"\"`
  ].join("\n");
}

export function buildSkeletonRepairInput(args: {
  text: string;
  invalidJson: string;
  validationErrors: string[];
  lang?: AnalyzePromptLang;
}): string {
  const lang: AnalyzePromptLang = args.lang === "en" ? "en" : "id";
  const invalidJsonPreview = trimWithHeadTail(args.invalidJson, SKELETON_PROMPT_LIMITS.repairInvalidJsonMaxChars);
  const excerpt = trimWithHeadTail(args.text, SKELETON_PROMPT_LIMITS.repairDocumentExcerptMaxChars);
  return [
    buildCoreInstruction(lang),
    "",
    "Previous output failed validation.",
    `Validation errors: ${args.validationErrors.join("; ")}`,
    "",
    "Return corrected JSON only.",
    "",
    "Invalid JSON to repair:",
    invalidJsonPreview,
    "",
    "Document excerpt:",
    `\"\"\"${excerpt}\"\"\"`
  ].join("\n");
}

export function buildSkeletonParseRepairInput(args: {
  text: string;
  rawOutputPreview: string;
  parseError: string;
  lang?: AnalyzePromptLang;
}): string {
  const lang: AnalyzePromptLang = args.lang === "en" ? "en" : "id";
  const rawPreview = trimWithHeadTail(args.rawOutputPreview, SKELETON_PROMPT_LIMITS.repairRawOutputPreviewMaxChars);
  const excerpt = trimWithHeadTail(args.text, SKELETON_PROMPT_LIMITS.repairDocumentExcerptMaxChars);
  return [
    buildCoreInstruction(lang),
    "",
    "Previous output failed JSON parsing.",
    `Parse error: ${args.parseError}`,
    "Return corrected JSON only.",
    "Do not use markdown code fences.",
    "Do not include any prose before or after JSON.",
    "",
    "Raw output preview:",
    rawPreview,
    "",
    "Document excerpt:",
    `\"\"\"${excerpt}\"\"\"`
  ].join("\n");
}
