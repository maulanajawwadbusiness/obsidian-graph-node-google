/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import skeletonModule from "../dist/llm/analyze/knowledgeSkeletonV1.js";
import topologyBuildModule from "../dist/llm/analyze/skeletonTopologyBuild.js";

const { validateKnowledgeSkeletonV1 } = skeletonModule;
const { buildTopologyFromSkeletonCore, applyTopologyToGraphState } = topologyBuildModule;

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

function assertRuntimeFields(snapshot) {
  for (const node of snapshot.nodes) {
    assert(typeof node.id === "string" && node.id.length > 0, "[skeleton-topology-runtime] node id missing");
  }
  const nodeIds = new Set(snapshot.nodes.map((n) => n.id));
  for (const link of snapshot.links) {
    assert(typeof link.from === "string" && link.from.length > 0, "[skeleton-topology-runtime] link.from missing");
    assert(typeof link.to === "string" && link.to.length > 0, "[skeleton-topology-runtime] link.to missing");
    assert(nodeIds.has(link.from) && nodeIds.has(link.to), "[skeleton-topology-runtime] link endpoint missing node");
  }
}

async function run() {
  const fixtureNames = [
    "knowledge_skeleton_v1_golden_3.json",
    "knowledge_skeleton_v1_golden_8.json",
    "knowledge_skeleton_v1_golden_12.json"
  ];

  for (const name of fixtureNames) {
    const raw = readFixture(name);
    const validation = validateKnowledgeSkeletonV1(raw);
    assert(validation.ok === true, `[skeleton-topology-runtime] fixture invalid: ${name}`);

    const builtA = buildTopologyFromSkeletonCore(validation.value, { seed: 101 });
    const builtB = buildTopologyFromSkeletonCore(validation.value, { seed: 101 });
    const builtC = buildTopologyFromSkeletonCore(validation.value, { seed: 202 });

    assertRuntimeFields(builtA);
    assert(
      JSON.stringify(builtA.nodes) === JSON.stringify(builtB.nodes) &&
      JSON.stringify(builtA.links) === JSON.stringify(builtB.links),
      `[skeleton-topology-runtime] topology not deterministic: ${name}`
    );
    assert(
      JSON.stringify(builtA.initialPositions) === JSON.stringify(builtB.initialPositions),
      `[skeleton-topology-runtime] initial positions not deterministic for seed: ${name}`
    );
    assert(
      JSON.stringify(builtA.initialPositions) !== JSON.stringify(builtC.initialPositions),
      `[skeleton-topology-runtime] initial positions must differ with different seed: ${name}`
    );

    let applyCalls = 0;
    let appliedTopology = null;
    applyTopologyToGraphState({ nodes: builtA.nodes, links: builtA.links }, (topology) => {
      applyCalls += 1;
      appliedTopology = topology;
    });
    assert(applyCalls === 1, `[skeleton-topology-runtime] apply must be atomic single-call: ${name}`);
    assert(appliedTopology !== null, `[skeleton-topology-runtime] applied topology missing: ${name}`);

    const topNodeId = builtA.nodes[0]?.id ?? "none";
    console.log(
      `[skeleton-topology-runtime] fixture=${name} nodes=${builtA.nodes.length} links=${builtA.links.length} top=${topNodeId}`
    );
  }

  console.log("[skeleton-topology-runtime] done");
}

run().catch((error) => {
  console.error(`[skeleton-topology-runtime] failed: ${error.message}`);
  process.exitCode = 1;
});
