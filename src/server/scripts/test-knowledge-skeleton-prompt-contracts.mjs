/* eslint-disable no-console */

import promptModule from "../dist/llm/analyze/skeletonPrompt.js";

const {
  buildSkeletonAnalyzeInput,
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
  assert(base.includes("slug-like"), "[knowledge-skeleton-prompt] base prompt must include id guidance");

  const repair = buildSkeletonRepairInput({
    text: "Sample document text.",
    invalidJson: "{\"nodes\":[]}",
    validationErrors: ["nodes: node_count_out_of_range"],
    lang: "en"
  });
  assert(repair.includes("Validation errors:"), "[knowledge-skeleton-prompt] repair prompt must include errors");
  assert(repair.includes("{\"nodes\":[]}"), "[knowledge-skeleton-prompt] repair prompt must include invalid json");
  assert(repair.includes("Return corrected JSON only"), "[knowledge-skeleton-prompt] repair prompt must force json-only repair");

  console.log("[knowledge-skeleton-prompt-contracts] prompt contract valid");
  console.log("[knowledge-skeleton-prompt-contracts] done");
}

run().catch((error) => {
  console.error(`[knowledge-skeleton-prompt-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
