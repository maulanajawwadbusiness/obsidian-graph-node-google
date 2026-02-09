export type AnalyzePromptLang = "id" | "en";

type AnalyzePromptBaseOpts = {
  nodeCount: number;
  lang?: AnalyzePromptLang;
};

type StructuredAnalyzePromptOpts = AnalyzePromptBaseOpts & {
  text: string;
};

type OpenrouterAnalyzePromptOpts = AnalyzePromptBaseOpts & {
  text: string;
  schema: object;
  validationErrors?: string[];
};

type Lens = {
  key: string;
  description: string;
};

const BASE_LENSES: Lens[] = [
  { key: "what", description: "what the text is directly about" },
  { key: "core_bet", description: "the real wager or thesis the text is staking" },
  { key: "opponent", description: "the worldview or practice being challenged" },
  { key: "bridge_weapon", description: "the method or framework translating claims into authority" },
  { key: "hidden_axioms", description: "unstated assumptions required for the argument to work" },
  { key: "downstream_power_risk", description: "what this enables and what it risks flattening or breaking" }
];

function normalizeNodeCount(nodeCount: number): number {
  if (!Number.isFinite(nodeCount)) return 5;
  return Math.max(2, Math.min(12, Math.floor(nodeCount)));
}

function getLanguageDirective(lang: AnalyzePromptLang): string {
  if (lang === "id") {
    return "LANGUAGE DIRECTIVE: You MUST write titles and explanations in Bahasa Indonesia, clear and formal.";
  }
  return "LANGUAGE DIRECTIVE: You MUST write titles and explanations in English.";
}

function buildRoleGuide(nodeCountRaw: number): string[] {
  const nodeCount = normalizeNodeCount(nodeCountRaw);
  const lines: string[] = [];
  lines.push(`Exactly ${nodeCount} points are required.`);
  if (nodeCount <= BASE_LENSES.length) {
    for (let pointIndex = 0; pointIndex < nodeCount; pointIndex += 1) {
      const startLens = Math.floor((pointIndex * BASE_LENSES.length) / nodeCount);
      const endLensExclusive = Math.floor(((pointIndex + 1) * BASE_LENSES.length) / nodeCount);
      const endLens = Math.max(startLens + 1, endLensExclusive);
      const merged = BASE_LENSES.slice(startLens, endLens)
        .map((lens) => `${lens.key}: ${lens.description}`)
        .join(" + ");
      lines.push(`- point ${pointIndex}: ${merged}`);
    }
    return lines;
  }

  for (let lensIndex = 0; lensIndex < BASE_LENSES.length; lensIndex += 1) {
    const lens = BASE_LENSES[lensIndex];
    lines.push(`- point ${lensIndex}: ${lens.key}: ${lens.description}`);
  }

  const extraAngles = [
    "counterfactual pressure test",
    "implementation tradeoff",
    "scope boundary and failure mode",
    "institutional incentive effect",
    "measurement distortion risk",
    "long-range second-order impact"
  ];

  for (let pointIndex = BASE_LENSES.length; pointIndex < nodeCount; pointIndex += 1) {
    const angle = extraAngles[(pointIndex - BASE_LENSES.length) % extraAngles.length];
    lines.push(`- point ${pointIndex}: deepen analysis via ${angle}`);
  }
  return lines;
}

function buildCoreInstruction(nodeCountRaw: number, lang: AnalyzePromptLang): string {
  const nodeCount = normalizeNodeCount(nodeCountRaw);
  const roleGuide = buildRoleGuide(nodeCount);
  const minLinks = Math.max(1, nodeCount - 1);

  return [
    "You are Arnvoid analyzer.",
    "You are not only a summarizer. You produce undercurrent analysis.",
    "",
    "Definition:",
    "- summary = what the text says.",
    "- analysis = what the text says and what it is doing: wager, opponent, bridge, assumptions, downstream power and risk.",
    "",
    "Output contract:",
    "- Return valid JSON only.",
    "- No markdown, no prose outside JSON.",
    "",
    "Required JSON keys:",
    "- paper_title: string",
    "- main_points: array of exactly nodeCount objects",
    "  each object must include: index, title, explanation",
    "- links: directed relationships between points",
    "  each object must include: from_index, to_index, type, weight, rationale",
    "",
    "Role guide by index:",
    ...roleGuide,
    "",
    "Main point constraints:",
    "- index values must be 0..nodeCount-1, unique, and complete.",
    "- title length 3-6 words and must reframe, not copy source phrasing.",
    "- explanation must be 4-8 sentences, each sentence adds new information.",
    "- avoid vague filler and avoid repeating the title in sentence form.",
    "",
    "Link constraints:",
    `- include at least ${minLinks} directed links unless evidence is truly insufficient.`,
    "- from_index and to_index must be valid point indices.",
    "- no self-links.",
    "- type should be concise and concrete (example: supports, depends_on, challenges, operationalizes, risks).",
    "- weight must be a number in [0,1].",
    "- rationale must explain why the edge exists, not restate labels.",
    "",
    "Safety and rigor:",
    "- stay respectful toward religious texts and people while remaining incisive.",
    "- if excerpt is incomplete, make careful inferences and do not invent specifics.",
    "",
    getLanguageDirective(lang)
  ].join("\n");
}

export function buildStructuredAnalyzeInput(opts: StructuredAnalyzePromptOpts): string {
  const lang: AnalyzePromptLang = opts.lang === "en" ? "en" : "id";
  const nodeCount = normalizeNodeCount(opts.nodeCount);
  return [
    buildCoreInstruction(nodeCount, lang),
    "",
    "Document excerpt:",
    `\"\"\"${opts.text}\"\"\"`
  ].join("\n");
}

export function buildOpenrouterAnalyzePrompt(opts: OpenrouterAnalyzePromptOpts): string {
  const lang: AnalyzePromptLang = opts.lang === "en" ? "en" : "id";
  const schemaText = JSON.stringify(opts.schema);
  const retrySection =
    opts.validationErrors && opts.validationErrors.length > 0
      ? [
          "",
          "Previous output failed validation.",
          `Validation errors: ${opts.validationErrors.join("; ")}`,
          "Repair all errors and return only corrected JSON."
        ].join("\n")
      : "";

  return [
    buildCoreInstruction(opts.nodeCount, lang),
    "",
    "JSON Schema:",
    schemaText,
    retrySection,
    "",
    "Document excerpt:",
    `\"\"\"${opts.text}\"\"\"`
  ].join("\n");
}
