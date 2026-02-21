/* eslint-disable no-console */

import promptModule from "../dist/llm/analyze/skeletonPrompt.js";

const {
  buildSkeletonRepairInput,
  buildSkeletonParseRepairInput,
  trimWithHeadTail,
  SKELETON_PROMPT_LIMITS
} = promptModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function repeat(char, count) {
  return new Array(count).fill(char).join("");
}

async function run() {
  const longText = repeat("T", 20000);
  const longJson = `{ "nodes": "${repeat("N", 20000)}" }`;
  const longRaw = `prefix ${repeat("R", 20000)} suffix`;

  const trimmed = trimWithHeadTail(longRaw, 128);
  assert(trimmed.includes("[truncated]"), "[knowledge-skeleton-repair-budget] trim must mark truncation");
  assert(trimmed.startsWith("prefix"), "[knowledge-skeleton-repair-budget] trim must keep head");
  assert(trimmed.endsWith("suffix"), "[knowledge-skeleton-repair-budget] trim must keep tail");

  const repair = buildSkeletonRepairInput({
    text: longText,
    invalidJson: longJson,
    validationErrors: ["edges: edge_count_out_of_range"],
    lang: "en"
  });
  assert(repair.includes("[truncated]"), "[knowledge-skeleton-repair-budget] repair prompt must include truncation marker");
  assert(repair.length <= 16000, "[knowledge-skeleton-repair-budget] repair prompt budget exceeded");

  const parseRepair = buildSkeletonParseRepairInput({
    text: longText,
    rawOutputPreview: longRaw,
    parseError: "invalid json",
    lang: "en"
  });
  assert(parseRepair.includes("[truncated]"), "[knowledge-skeleton-repair-budget] parse repair must include truncation marker");
  assert(parseRepair.length <= 12000, "[knowledge-skeleton-repair-budget] parse repair prompt budget exceeded");
  assert(
    parseRepair.includes("Do not include any prose before or after JSON."),
    "[knowledge-skeleton-repair-budget] parse repair strictness missing"
  );

  assert(SKELETON_PROMPT_LIMITS.repairDocumentExcerptMaxChars === 3000, "[knowledge-skeleton-repair-budget] doc cap drift");
  assert(SKELETON_PROMPT_LIMITS.repairInvalidJsonMaxChars === 8000, "[knowledge-skeleton-repair-budget] invalid json cap drift");
  assert(SKELETON_PROMPT_LIMITS.repairRawOutputPreviewMaxChars === 2000, "[knowledge-skeleton-repair-budget] raw preview cap drift");

  console.log("[knowledge-skeleton-repair-budget-contracts] prompt truncation and cap budget valid");
  console.log("[knowledge-skeleton-repair-budget-contracts] done");
}

run().catch((error) => {
  console.error(`[knowledge-skeleton-repair-budget-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
