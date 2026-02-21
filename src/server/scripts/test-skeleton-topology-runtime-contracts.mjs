/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import skeletonModule from "../dist/llm/analyze/knowledgeSkeletonV1.js";
import topologyBuildModule from "../dist/llm/analyze/skeletonTopologyBuild.js";
import adapterModule from "../dist/llm/analyze/knowledgeSkeletonAdapter.js";
import hydrationModule from "../dist/llm/analyze/skeletonHydration.js";

const { validateKnowledgeSkeletonV1 } = skeletonModule;
const { buildTopologyFromSkeletonCore, applyTopologyToGraphState } = topologyBuildModule;
const { skeletonToTopologyCore } = adapterModule;
const { hydrateSkeletonNodePositions, buildHydratedRuntimeSnapshot } = hydrationModule;

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

const EXPECTED_NODE_ORDER = {
  "knowledge_skeleton_v1_golden_3.json": [
    "g3-claim",
    "g3-evidence",
    "g3-limitation"
  ],
  "knowledge_skeleton_v1_golden_8.json": [
    "g8-claim",
    "g8-evidence-a",
    "g8-method",
    "g8-context-a",
    "g8-limitation",
    "g8-context-b",
    "g8-assumption",
    "g8-evidence-b"
  ],
  "knowledge_skeleton_v1_golden_12.json": [
    "g12-claim",
    "g12-e1",
    "g12-e2",
    "g12-m1",
    "g12-m2",
    "g12-c1",
    "g12-l1",
    "g12-l2",
    "g12-c2",
    "g12-a1",
    "g12-a2",
    "g12-e3"
  ]
};

const EXPECTED_EDGE_ORDER = {
  "knowledge_skeleton_v1_golden_3.json": [
    "g3-evidence|g3-claim|supports",
    "g3-limitation|g3-claim|limits"
  ],
  "knowledge_skeleton_v1_golden_8.json": [
    "g8-evidence-a|g8-claim|supports",
    "g8-method|g8-evidence-a|produces",
    "g8-method|g8-claim|operationalizes",
    "g8-limitation|g8-claim|limits",
    "g8-assumption|g8-method|depends_on",
    "g8-context-b|g8-claim|challenges",
    "g8-context-a|g8-method|depends_on",
    "g8-evidence-b|g8-claim|challenges"
  ],
  "knowledge_skeleton_v1_golden_12.json": [
    "g12-e1|g12-claim|supports",
    "g12-e2|g12-claim|supports",
    "g12-m1|g12-e1|produces",
    "g12-m2|g12-e2|produces",
    "g12-m1|g12-claim|operationalizes",
    "g12-l1|g12-claim|limits",
    "g12-l2|g12-m1|limits",
    "g12-a1|g12-m1|depends_on",
    "g12-a2|g12-m2|depends_on",
    "g12-c2|g12-claim|challenges",
    "g12-c1|g12-m2|depends_on",
    "g12-e3|g12-claim|challenges"
  ]
};

function assertExpectedOrder(name, built) {
  const nodeIds = built.nodes.map((node) => node.id);
  const expectedNodes = EXPECTED_NODE_ORDER[name];
  assert(
    JSON.stringify(nodeIds) === JSON.stringify(expectedNodes),
    `[skeleton-topology-runtime] unexpected node order: ${name}`
  );

  const edgeKeys = built.links.map((link) => `${link.from}|${link.to}|${link.kind ?? ""}`);
  const expectedEdges = EXPECTED_EDGE_ORDER[name];
  assert(
    JSON.stringify(edgeKeys) === JSON.stringify(expectedEdges),
    `[skeleton-topology-runtime] unexpected edge order: ${name}`
  );
}

function assertPositionPrecision(snapshot) {
  for (const nodeId of Object.keys(snapshot.initialPositions)) {
    const pos = snapshot.initialPositions[nodeId];
    assert(
      Number(pos.x.toFixed(6)) === pos.x && Number(pos.y.toFixed(6)) === pos.y,
      `[skeleton-topology-runtime] initial position precision mismatch for ${nodeId}`
    );
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
    assertExpectedOrder(name, builtA);
    assertPositionPrecision(builtA);
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
    const hydratedA = buildHydratedRuntimeSnapshot({
      skeleton: validation.value,
      seed: 101,
      spacing: 140
    });
    const hydratedB = buildHydratedRuntimeSnapshot({
      skeleton: validation.value,
      seed: 101,
      spacing: 140
    });
    assert(
      JSON.stringify(hydratedA) === JSON.stringify(hydratedB),
      `[skeleton-topology-runtime] hydrated positions not deterministic for seed: ${name}`
    );
    assert(
      hydratedA.applyCalls === 1 && hydratedB.applyCalls === 1,
      `[skeleton-topology-runtime] hydrated runtime snapshot must use single apply call: ${name}`
    );
    const hydratedC = buildHydratedRuntimeSnapshot({
      skeleton: validation.value,
      seed: 202,
      spacing: 140
    });
    assert(
      JSON.stringify(hydratedA) !== JSON.stringify(hydratedC),
      `[skeleton-topology-runtime] hydrated positions must differ with different seed: ${name}`
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

  const minimal = readFixture("knowledge_skeleton_v1_minimal.json");
  const duplicateEdgePayload = clone(minimal);
  duplicateEdgePayload.edges.push({
    from: duplicateEdgePayload.edges[0].from,
    to: duplicateEdgePayload.edges[0].to,
    type: duplicateEdgePayload.edges[0].type,
    weight: 0.33,
    rationale: "duplicate edge for negative contract"
  });
  const duplicateEdgeValidation = validateKnowledgeSkeletonV1(duplicateEdgePayload);
  assert(
    duplicateEdgeValidation.ok === false &&
      duplicateEdgeValidation.errors.some((entry) => entry.code === "duplicate_edge_semantic"),
    "[skeleton-topology-runtime] duplicate edge negative contract failed"
  );

  const orphanPayload = clone(minimal);
  orphanPayload.edges = [
    {
      from: "n-method",
      to: "n-claim",
      type: "operationalizes",
      weight: 0.7,
      rationale: "disconnect limit node"
    }
  ];
  const orphanValidation = validateKnowledgeSkeletonV1(orphanPayload);
  assert(
    orphanValidation.ok === false &&
      orphanValidation.errors.some((entry) => entry.code === "orphan_nodes_excessive"),
    "[skeleton-topology-runtime] orphan negative contract failed"
  );

  const malformedValidation = validateKnowledgeSkeletonV1({ nodes: [], edges: [] });
  assert(
    malformedValidation.ok === false &&
      malformedValidation.errors.some((entry) => entry.code === "node_count_out_of_range"),
    "[skeleton-topology-runtime] malformed payload should fail fast"
  );

  const unicodeTieSkeleton = {
    nodes: [
      { role: "claim", id: "u-claim", label: "Claim", summary: "Claim", pressure: 0.9, confidence: 0.8 },
      { role: "evidence", id: "u-e1", label: "Evidence 1", summary: "Evidence 1", pressure: 0.8, confidence: 0.8 },
      { role: "evidence", id: "u-e2", label: "Evidence 2", summary: "Evidence 2", pressure: 0.7, confidence: 0.8 }
    ],
    edges: [
      { from: "u-e1", to: "u-claim", type: "supports", weight: 0.7, rationale: "zeta" },
      { from: "u-e1", to: "u-claim", type: "supports", weight: 0.7, rationale: "alpha" },
      { from: "u-e1", to: "u-claim", type: "supports", weight: 0.7, rationale: "beta" },
      { from: "u-e2", to: "u-claim", type: "supports", weight: 0.7, rationale: "aster" },
      { from: "u-e2", to: "u-claim", type: "supports", weight: 0.7, rationale: "zetta" },
      { from: "u-e2", to: "u-claim", type: "supports", weight: 0.7, rationale: "alpha" }
    ]
  };
  const unicodeMapped = skeletonToTopologyCore(unicodeTieSkeleton);
  const rationaleBySource = unicodeMapped.links
    .filter((link) => link.from === "u-e1")
    .map((link) => String(link.meta?.rationale ?? ""));
  assert(
    JSON.stringify(rationaleBySource) === JSON.stringify(["alpha", "beta", "zeta"]),
    "[skeleton-topology-runtime] code-unit rationale tie-break ordering failed"
  );
  const unicodeHydratedA = buildHydratedRuntimeSnapshot({
    skeleton: unicodeTieSkeleton,
    seed: 444,
    spacing: 140
  });
  const unicodeHydratedB = buildHydratedRuntimeSnapshot({
    skeleton: unicodeTieSkeleton,
    seed: 444,
    spacing: 140
  });
  assert(
    JSON.stringify(unicodeHydratedA) === JSON.stringify(unicodeHydratedB),
    "[skeleton-topology-runtime] unicode hydration determinism failed"
  );

  console.log("[skeleton-topology-runtime] done");
}

run().catch((error) => {
  console.error(`[skeleton-topology-runtime] failed: ${error.message}`);
  process.exitCode = 1;
});
