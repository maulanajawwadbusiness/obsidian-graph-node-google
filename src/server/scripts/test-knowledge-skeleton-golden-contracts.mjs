/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import skeletonModule from "../dist/llm/analyze/knowledgeSkeletonV1.js";

const {
  validateKnowledgeSkeletonV1,
  SKELETON_NODE_ROLES,
  SKELETON_EDGE_TYPES
} = skeletonModule;

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

async function run() {
  const fixtureNames = [
    "knowledge_skeleton_v1_golden_3.json",
    "knowledge_skeleton_v1_golden_8.json",
    "knowledge_skeleton_v1_golden_12.json"
  ];

  const seenRoles = new Set();
  const seenEdgeTypes = new Set();

  for (const name of fixtureNames) {
    const raw = readFixture(name);
    const result = validateKnowledgeSkeletonV1(raw);
    assert(result.ok === true, `[knowledge-skeleton-golden] fixture invalid: ${name}`);
    for (const node of result.value.nodes) {
      seenRoles.add(node.role);
    }
    for (const edge of result.value.edges) {
      seenEdgeTypes.add(edge.type);
    }
  }

  for (const role of SKELETON_NODE_ROLES) {
    assert(seenRoles.has(role), `[knowledge-skeleton-golden] missing role coverage: ${role}`);
  }
  for (const edgeType of SKELETON_EDGE_TYPES) {
    assert(seenEdgeTypes.has(edgeType), `[knowledge-skeleton-golden] missing edge type coverage: ${edgeType}`);
  }

  console.log("[knowledge-skeleton-golden-contracts] golden fixtures valid");
  console.log("[knowledge-skeleton-golden-contracts] role and edge coverage valid");
  console.log("[knowledge-skeleton-golden-contracts] done");
}

run().catch((error) => {
  console.error(`[knowledge-skeleton-golden-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
