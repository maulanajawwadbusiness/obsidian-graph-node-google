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

function getLanguageDirective(lang: AnalyzePromptLang): string {
  if (lang === "id") {
    return "LANGUAGE DIRECTIVE: Write label, summary, and rationale in Bahasa Indonesia.";
  }
  return "LANGUAGE DIRECTIVE: Write label, summary, and rationale in English.";
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
    "- Keep graph glance-readable and avoid edge spam.",
    "",
    getLanguageDirective(lang)
  ].join("\n");
}

export function buildSkeletonAnalyzeInput(opts: SkeletonPromptOpts): string {
  const lang: AnalyzePromptLang = opts.lang === "en" ? "en" : "id";
  return [
    buildCoreInstruction(lang),
    "",
    "Document excerpt:",
    `\"\"\"${opts.text}\"\"\"`
  ].join("\n");
}

export function buildSkeletonRepairInput(args: {
  text: string;
  invalidJson: string;
  validationErrors: string[];
  lang?: AnalyzePromptLang;
}): string {
  const lang: AnalyzePromptLang = args.lang === "en" ? "en" : "id";
  return [
    buildCoreInstruction(lang),
    "",
    "Previous output failed validation.",
    `Validation errors: ${args.validationErrors.join("; ")}`,
    "",
    "Return corrected JSON only.",
    "",
    "Invalid JSON to repair:",
    args.invalidJson,
    "",
    "Document excerpt:",
    `\"\"\"${args.text}\"\"\"`
  ].join("\n");
}
