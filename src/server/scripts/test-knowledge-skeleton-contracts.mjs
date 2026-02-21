/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import knowledgeSkeletonModule from "../dist/llm/analyze/knowledgeSkeletonV1.js";

const {
  validateKnowledgeSkeletonV1,
  getSkeletonV1EdgeMax
} = knowledgeSkeletonModule;

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

function assertValidFixture(fileName) {
  const fixture = readFixture(fileName);
  const result = validateKnowledgeSkeletonV1(fixture);
  assert(result && result.ok === true, `[knowledge-skeleton] expected valid fixture: ${fileName}`);
}

function assertInvalid(payload, errorCode) {
  const result = validateKnowledgeSkeletonV1(payload);
  assert(result && result.ok === false, `[knowledge-skeleton] expected invalid payload for ${errorCode}`);
  assert(result.errors.some((entry) => entry.code === errorCode), `[knowledge-skeleton] missing error code ${errorCode}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function run() {
  const minimal = readFixture("knowledge_skeleton_v1_minimal.json");
  assertValidFixture("knowledge_skeleton_v1_minimal.json");
  assertValidFixture("knowledge_skeleton_v1_typical.json");
  assertValidFixture("knowledge_skeleton_v1_bounds.json");

  const badEnum = clone(minimal);
  badEnum.nodes[0].role = "invalid_role";
  assertInvalid(badEnum, "node_role_invalid");

  const outOfRange = clone(minimal);
  outOfRange.nodes[0].pressure = 1.2;
  assertInvalid(outOfRange, "node_pressure_out_of_range");

  const missingRef = clone(minimal);
  missingRef.edges[0].to = "missing-node";
  assertInvalid(missingRef, "edge_to_missing_node");

  const duplicateId = clone(minimal);
  duplicateId.nodes[1].id = duplicateId.nodes[0].id;
  assertInvalid(duplicateId, "node_id_duplicate");

  const invalidIdChars = clone(minimal);
  invalidIdChars.nodes[0].id = "Bad ID";
  assertInvalid(invalidIdChars, "node_id_invalid_chars");

  const unknownRootField = clone(minimal);
  unknownRootField.extra_root = true;
  assertInvalid(unknownRootField, "unknown_property");

  const unknownNodeField = clone(minimal);
  unknownNodeField.nodes[0].extra_node = "x";
  assertInvalid(unknownNodeField, "unknown_property");

  const unknownEdgeField = clone(minimal);
  unknownEdgeField.edges[0].extra_edge = "x";
  assertInvalid(unknownEdgeField, "unknown_property");

  const tooManyNodes = clone(minimal);
  while (tooManyNodes.nodes.length < 13) {
    const nextIndex = tooManyNodes.nodes.length + 1;
    tooManyNodes.nodes.push({
      role: "context",
      id: `n-extra-${nextIndex}`,
      label: `Extra ${nextIndex}`,
      summary: `Extra summary ${nextIndex}`,
      pressure: 0.5,
      confidence: 0.5
    });
  }
  assertInvalid(tooManyNodes, "node_count_out_of_range");

  const tooManyEdges = clone(minimal);
  const edgeMax = getSkeletonV1EdgeMax(tooManyEdges.nodes.length);
  while (tooManyEdges.edges.length <= edgeMax) {
    const idx = tooManyEdges.edges.length;
    tooManyEdges.edges.push({
      from: "n-claim",
      to: "n-method",
      type: "supports",
      weight: 0.5,
      rationale: `extra edge ${idx}`
    });
  }
  assertInvalid(tooManyEdges, "edge_count_out_of_range");

  const selfLoop = clone(minimal);
  selfLoop.edges[0].to = selfLoop.edges[0].from;
  assertInvalid(selfLoop, "edge_self_loop");

  const orphanGraph = clone(minimal);
  orphanGraph.edges = [
    {
      from: "n-method",
      to: "n-claim",
      type: "operationalizes",
      weight: 0.82,
      rationale: "single edge leaves one node disconnected"
    }
  ];
  assertInvalid(orphanGraph, "orphan_nodes_excessive");

  console.log("[knowledge-skeleton-contracts] fixtures valid");
  console.log("[knowledge-skeleton-contracts] invalid matrix valid");
  console.log("[knowledge-skeleton-contracts] done");
}

run().catch((error) => {
  console.error(`[knowledge-skeleton-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
