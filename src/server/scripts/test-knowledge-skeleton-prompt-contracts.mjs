/* eslint-disable no-console */

import promptModule from "../dist/llm/analyze/skeletonPrompt.js";

const {
  buildSkeletonAnalyzeInput,
  buildSkeletonParseRepairInput,
  buildSkeletonRepairInput
} = promptModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const base = buildSkeletonAnalyzeInput({
    text: "Sample document text.",
    lang: "en"
  });
  assert(base.includes("No orphan nodes"), "[knowledge-skeleton-prompt] base prompt must include no orphan rule");
  assert(base.includes("edges <= max(6, nodeCount * 2)"), "[knowledge-skeleton-prompt] base prompt must include edge cap rule");
  assert(base.includes("No duplicate semantic edges"), "[knowledge-skeleton-prompt] base prompt must include duplicate-edge rule");
  assert(base.includes("slug-like"), "[knowledge-skeleton-prompt] base prompt must include id guidance");

  const repair = buildSkeletonRepairInput({
    text: "Sample document text.",
    invalidJson: "{\"nodes\":[]}",
    validationErrors: ["edges: orphan_nodes_excessive (orphan nodes are not allowed) details={\"orphan_ids\":[\"n-evidence\"]}"],
    lang: "en"
  });
  assert(repair.includes("Validation errors:"), "[knowledge-skeleton-prompt] repair prompt must include errors");
  assert(repair.includes("{\"nodes\":[]}"), "[knowledge-skeleton-prompt] repair prompt must include invalid json");
  assert(repair.includes("Return corrected JSON only"), "[knowledge-skeleton-prompt] repair prompt must force json-only repair");
  assert(repair.includes("orphan_ids"), "[knowledge-skeleton-prompt] repair prompt must include actionable orphan ids");

  const parseRepair = buildSkeletonParseRepairInput({
    text: "Sample document text.",
    rawOutputContext: "```json\\n{}\\n```",
    parseError: "invalid json",
    lang: "en"
  });
  assert(parseRepair.includes("failed JSON parsing"), "[knowledge-skeleton-prompt] parse repair must include parse context");
  assert(parseRepair.includes("Do not use markdown code fences"), "[knowledge-skeleton-prompt] parse repair must forbid fences");
  assert(parseRepair.includes("must satisfy all graph constraints"), "[knowledge-skeleton-prompt] parse repair must enforce constraints");
  assert(parseRepair.includes("Return corrected JSON only"), "[knowledge-skeleton-prompt] parse repair must force json-only repair");

  console.log("[knowledge-skeleton-prompt-contracts] prompt contract valid");
  console.log("[knowledge-skeleton-prompt-contracts] done");
}

run().catch((error) => {
  console.error(`[knowledge-skeleton-prompt-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
