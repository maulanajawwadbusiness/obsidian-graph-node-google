/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import skeletonModule from "../dist/llm/analyze/knowledgeSkeletonV1.js";

const { validateKnowledgeSkeletonV1 } = skeletonModule;

function readFixture(relativePath) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fixturePath = path.resolve(__dirname, "..", "..", "..", "docs", "fixtures", relativePath);
  const raw = fs.readFileSync(fixturePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

async function run() {
  const fixtureNames = [
    "knowledge_skeleton_v1_golden_3.json",
    "knowledge_skeleton_v1_golden_8.json",
    "knowledge_skeleton_v1_golden_12.json"
  ];

  let totalNodes = 0;
  let totalEdges = 0;

  for (const name of fixtureNames) {
    const raw = readFixture(name);
    const result = validateKnowledgeSkeletonV1(raw);
    if (!result.ok) {
      console.error(`[knowledge-skeleton-harness] invalid fixture=${name} errors=${JSON.stringify(result.errors)}`);
      process.exitCode = 1;
      return;
    }
    totalNodes += result.value.nodes.length;
    totalEdges += result.value.edges.length;
    console.log(
      `[knowledge-skeleton-harness] fixture=${name} nodes=${result.value.nodes.length} edges=${result.value.edges.length}`
    );
  }

  console.log(`[knowledge-skeleton-harness] fixtures=${fixtureNames.length} total_nodes=${totalNodes} total_edges=${totalEdges}`);
  console.log("[knowledge-skeleton-harness] done");
}

run().catch((error) => {
  console.error(`[knowledge-skeleton-harness] failed: ${error.message}`);
  process.exitCode = 1;
});
