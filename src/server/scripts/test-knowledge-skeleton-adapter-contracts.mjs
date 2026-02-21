/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import skeletonModule from "../dist/llm/analyze/knowledgeSkeletonV1.js";
import adapterModule from "../dist/llm/analyze/knowledgeSkeletonAdapter.js";

const { validateKnowledgeSkeletonV1 } = skeletonModule;
const { skeletonToTopologyCore } = adapterModule;

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

function assertStableOrdering(mapped) {
  for (let i = 1; i < mapped.nodes.length; i += 1) {
    const prev = mapped.nodes[i - 1];
    const curr = mapped.nodes[i];
    const prevPressure = Number(prev.meta?.pressure ?? 0);
    const currPressure = Number(curr.meta?.pressure ?? 0);
    if (prevPressure < currPressure) {
      throw new Error("[knowledge-skeleton-adapter] node ordering by pressure is not descending");
    }
  }
}

function assertCountsPreserved(source, mapped) {
  assert(source.nodes.length === mapped.nodes.length, "[knowledge-skeleton-adapter] node count mismatch");
  assert(source.edges.length === mapped.links.length, "[knowledge-skeleton-adapter] edge count mismatch");
}

async function run() {
  const fixtures = [
    "knowledge_skeleton_v1_minimal.json",
    "knowledge_skeleton_v1_typical.json",
    "knowledge_skeleton_v1_bounds.json"
  ];

  for (const name of fixtures) {
    const raw = readFixture(name);
    const validated = validateKnowledgeSkeletonV1(raw);
    assert(validated.ok === true, `[knowledge-skeleton-adapter] fixture must validate: ${name}`);

    const mappedA = skeletonToTopologyCore(validated.value);
    const mappedB = skeletonToTopologyCore(validated.value);

    assertCountsPreserved(validated.value, mappedA);
    assertStableOrdering(mappedA);

    const jsonA = JSON.stringify(mappedA);
    const jsonB = JSON.stringify(mappedB);
    assert(jsonA === jsonB, `[knowledge-skeleton-adapter] mapping must be deterministic: ${name}`);
  }

  const tiePayload = {
    nodes: [
      { role: "claim", id: "n-claim", label: "Claim", summary: "Claim summary", pressure: 0.8, confidence: 0.8 },
      { role: "evidence", id: "n-evidence", label: "Evidence", summary: "Evidence summary", pressure: 0.7, confidence: 0.7 },
      { role: "method", id: "n-method", label: "Method", summary: "Method summary", pressure: 0.6, confidence: 0.6 }
    ],
    edges: [
      { from: "n-claim", to: "n-evidence", type: "supports", weight: 0.5, rationale: "zeta" },
      { from: "n-claim", to: "n-evidence", type: "depends_on", weight: 0.5, rationale: "alpha" },
      { from: "n-claim", to: "n-method", type: "produces", weight: 0.5, rationale: "beta" }
    ]
  };
  const tieValidated = validateKnowledgeSkeletonV1(tiePayload);
  assert(tieValidated.ok === true, "[knowledge-skeleton-adapter] tie payload must validate");
  const tieMappedA = skeletonToTopologyCore(tieValidated.value);
  const tieMappedB = skeletonToTopologyCore(tieValidated.value);
  assert(JSON.stringify(tieMappedA) === JSON.stringify(tieMappedB), "[knowledge-skeleton-adapter] tie mapping must be deterministic");

  console.log("[knowledge-skeleton-adapter-contracts] fixture mapping valid");
  console.log("[knowledge-skeleton-adapter-contracts] deterministic ordering valid");
  console.log("[knowledge-skeleton-adapter-contracts] done");
}

run().catch((error) => {
  console.error(`[knowledge-skeleton-adapter-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
