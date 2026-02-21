/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import analyzeModule from "../dist/llm/analyze/skeletonAnalyze.js";

const {
  analyzeDocumentToSkeletonV1,
  summarizeValidationErrorsForRepair,
  toRawPreviewForLogs,
  toRepairContext
} = analyzeModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readFixture(relativePath) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fixturePath = path.resolve(__dirname, "..", "..", "..", "docs", "fixtures", relativePath);
  const raw = fs.readFileSync(fixturePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function createOpenrouterProvider(outputs) {
  let callIndex = 0;
  const promptHistory = [];
  return {
    name: "openrouter",
    async generateText(input) {
      const next = outputs[Math.min(callIndex, outputs.length - 1)];
      promptHistory.push(String(input?.input ?? ""));
      callIndex += 1;
      return {
        ok: true,
        text: next,
        usage: { input_tokens: 10, output_tokens: 20 }
      };
    },
    getCallCount() {
      return callIndex;
    },
    getPromptHistory() {
      return promptHistory;
    }
  };
}

async function run() {
  const minimal = readFixture("knowledge_skeleton_v1_minimal.json");
  const validJson = JSON.stringify(minimal);
  const semanticInvalid = JSON.stringify({
    ...minimal,
    edges: [
      {
        from: "n-method",
        to: "n-claim",
        type: "operationalizes",
        weight: 0.82,
        rationale: "single edge leaves one node disconnected"
      }
    ]
  });

  const fencedProvider = createOpenrouterProvider([`Here:\n\`\`\`json\n${validJson}\n\`\`\``]);
  const fencedResult = await analyzeDocumentToSkeletonV1({
    provider: fencedProvider,
    model: "gpt-4.1-mini",
    text: "sample"
  });
  assert(fencedResult.ok === true, "[knowledge-skeleton-analyze] fenced json should parse");

  const proseProvider = createOpenrouterProvider([`Some preface text.\n${validJson}\nTrailing text.`]);
  const proseResult = await analyzeDocumentToSkeletonV1({
    provider: proseProvider,
    model: "gpt-4.1-mini",
    text: "sample"
  });
  assert(proseResult.ok === true, "[knowledge-skeleton-analyze] prose-wrapped json should parse");

  const repairedProvider = createOpenrouterProvider([
    "{ bad json",
    validJson
  ]);
  const repairedResult = await analyzeDocumentToSkeletonV1({
    provider: repairedProvider,
    model: "gpt-4.1-mini",
    text: "sample"
  });
  assert(repairedResult.ok === true, "[knowledge-skeleton-analyze] parse error should repair");
  assert(repairedResult.validation_result === "retry_ok", "[knowledge-skeleton-analyze] repaired run must be retry_ok");
  assert(repairedProvider.getCallCount() === 2, "[knowledge-skeleton-analyze] repaired run call count should be 2");

  const alwaysBadProvider = createOpenrouterProvider(["{ bad json"]);
  const alwaysBadResult = await analyzeDocumentToSkeletonV1({
    provider: alwaysBadProvider,
    model: "gpt-4.1-mini",
    text: "sample"
  });
  assert(alwaysBadResult.ok === false, "[knowledge-skeleton-analyze] malformed json should fail");
  assert(alwaysBadResult.code === "parse_error", "[knowledge-skeleton-analyze] malformed json should return parse_error");
  assert(alwaysBadProvider.getCallCount() === 2, "[knowledge-skeleton-analyze] parse error retries should cap at 1");

  const parseThenSemanticProvider = createOpenrouterProvider([
    "{ bad json",
    semanticInvalid,
    validJson
  ]);
  const parseThenSemanticResult = await analyzeDocumentToSkeletonV1({
    provider: parseThenSemanticProvider,
    model: "gpt-4.1-mini",
    text: "sample"
  });
  assert(parseThenSemanticResult.ok === true, "[knowledge-skeleton-analyze] semantic retries should survive parse retry");
  assert(parseThenSemanticResult.validation_result === "retry_ok", "[knowledge-skeleton-analyze] combined retries should be retry_ok");
  assert(parseThenSemanticProvider.getCallCount() === 3, "[knowledge-skeleton-analyze] parse + semantic retries must stay within total cap");

  const parseThenDoubleSemanticProvider = createOpenrouterProvider([
    "{ bad json",
    semanticInvalid,
    semanticInvalid
  ]);
  const parseThenDoubleSemanticResult = await analyzeDocumentToSkeletonV1({
    provider: parseThenDoubleSemanticProvider,
    model: "gpt-4.1-mini",
    text: "sample"
  });
  assert(parseThenDoubleSemanticResult.ok === false, "[knowledge-skeleton-analyze] parse path should allow only one semantic repair");
  assert(parseThenDoubleSemanticResult.code === "skeleton_output_invalid", "[knowledge-skeleton-analyze] expected semantic invalid failure");
  assert(parseThenDoubleSemanticProvider.getCallCount() === 3, "[knowledge-skeleton-analyze] parse path total calls must cap at 3");

  const semanticOnlyFailProvider = createOpenrouterProvider([semanticInvalid, semanticInvalid, semanticInvalid, validJson]);
  const semanticOnlyFailResult = await analyzeDocumentToSkeletonV1({
    provider: semanticOnlyFailProvider,
    model: "gpt-4.1-mini",
    text: "sample"
  });
  assert(semanticOnlyFailResult.ok === false, "[knowledge-skeleton-analyze] semantic-only repeated failures should fail at cap");
  assert(semanticOnlyFailProvider.getCallCount() === 3, "[knowledge-skeleton-analyze] semantic-only total calls must cap at 3");

  const hugeInvalidRaw = `{ "payload": "${"X".repeat(12000)}" `;
  const contextProvider = createOpenrouterProvider([hugeInvalidRaw, validJson]);
  const contextResult = await analyzeDocumentToSkeletonV1({
    provider: contextProvider,
    model: "gpt-4.1-mini",
    text: "sample"
  });
  assert(contextResult.ok === true, "[knowledge-skeleton-analyze] context probe run should recover after parse repair");
  const contextPrompt = contextProvider.getPromptHistory()[1] || "";
  assert(contextPrompt.length > 2000, "[knowledge-skeleton-analyze] repair prompt should include >2000 context when available");
  const previewOnly = toRawPreviewForLogs(hugeInvalidRaw);
  const repairContext = toRepairContext(hugeInvalidRaw);
  assert(previewOnly.length <= 2000, "[knowledge-skeleton-analyze] log preview must stay within 2000 cap");
  assert(repairContext.length > 2000, "[knowledge-skeleton-analyze] repair context should exceed preview size");
  assert(repairContext.length <= 8000, "[knowledge-skeleton-analyze] repair context must stay within 8000 cap");

  const manyErrors = [];
  manyErrors.push({
    code: "orphan_nodes_excessive",
    message: "orphan nodes are not allowed: n-1",
    path: "edges",
    details: { orphan_ids: ["n-1"] }
  });
  for (let i = 0; i < 30; i += 1) {
    manyErrors.push({
      code: i % 2 === 0 ? "unknown_property" : "node_label_empty",
      message: `error-${i}`,
      path: `nodes[${i}]`
    });
  }
  const summarized = summarizeValidationErrorsForRepair(manyErrors);
  assert(summarized.lines.length === 21, "[knowledge-skeleton-analyze] summarized errors should be capped with truncation marker");
  assert(summarized.lines[0].includes("orphan_nodes_excessive"), "[knowledge-skeleton-analyze] orphan error must be prioritized");
  assert(summarized.lines[0].includes("orphan_ids"), "[knowledge-skeleton-analyze] orphan ids must be preserved in summary");
  assert(summarized.lines[summarized.lines.length - 1].includes("more errors truncated"), "[knowledge-skeleton-analyze] truncation marker missing");

  console.log("[knowledge-skeleton-analyze-contracts] parse extraction + repair behavior valid");
  console.log("[knowledge-skeleton-analyze-contracts] done");
}

run().catch((error) => {
  console.error(`[knowledge-skeleton-analyze-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
