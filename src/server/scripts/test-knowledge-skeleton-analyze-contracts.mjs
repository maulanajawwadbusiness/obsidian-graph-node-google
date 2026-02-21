/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import analyzeModule from "../dist/llm/analyze/skeletonAnalyze.js";

const { analyzeDocumentToSkeletonV1 } = analyzeModule;

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
  return {
    name: "openrouter",
    async generateText() {
      const next = outputs[Math.min(callIndex, outputs.length - 1)];
      callIndex += 1;
      return {
        ok: true,
        text: next,
        usage: { input_tokens: 10, output_tokens: 20 }
      };
    },
    getCallCount() {
      return callIndex;
    }
  };
}

async function run() {
  const minimal = readFixture("knowledge_skeleton_v1_minimal.json");
  const validJson = JSON.stringify(minimal);

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
  assert(alwaysBadProvider.getCallCount() === 3, "[knowledge-skeleton-analyze] parse error retries should cap at 2");

  console.log("[knowledge-skeleton-analyze-contracts] parse extraction + repair behavior valid");
  console.log("[knowledge-skeleton-analyze-contracts] done");
}

run().catch((error) => {
  console.error(`[knowledge-skeleton-analyze-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
