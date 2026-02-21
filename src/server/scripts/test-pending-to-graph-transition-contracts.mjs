/* eslint-disable no-console */

import transitionPolicyModule from "../dist/llm/analyze/pendingAnalysisTransitionPolicy.js";
import flowGuardsModule from "../dist/llm/analyze/analysisFlowGuards.js";
import topologyBuildModule from "../dist/llm/analyze/skeletonTopologyBuild.js";

const {
  shouldDelayPendingConsume,
  shouldConsumePendingAtStart,
  shouldConsumePendingAfterAsync,
  shouldAllowZeroNodePendingAnalysis
} = transitionPolicyModule;
const { buildPendingAnalysisPayloadKey, shouldResetPendingConsumeLatch } = flowGuardsModule;
const { applyTopologyToGraphState } = topologyBuildModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runPendingFlow(mode, outcome) {
  const events = [];
  if (shouldConsumePendingAtStart(mode)) {
    events.push("consume_start");
  }
  events.push("analysis_begin");
  events.push(outcome === "ok" ? "analysis_ok" : "analysis_error");
  if (shouldConsumePendingAfterAsync(mode)) {
    events.push("consume_finally");
  }
  events.push("pending_done");
  return events;
}

function run() {
  assert(shouldDelayPendingConsume("classic") === false, "[pending-to-graph] classic should not delay consume");
  assert(shouldDelayPendingConsume("skeleton_v1") === true, "[pending-to-graph] skeleton should delay consume");
  assert(
    shouldAllowZeroNodePendingAnalysis("classic") === false,
    "[pending-to-graph] classic should block zero-node pending analysis"
  );
  assert(
    shouldAllowZeroNodePendingAnalysis("skeleton_v1") === true,
    "[pending-to-graph] skeleton should allow zero-node pending analysis"
  );

  const classicEvents = runPendingFlow("classic", "ok");
  assert(
    JSON.stringify(classicEvents) === JSON.stringify(["consume_start", "analysis_begin", "analysis_ok", "pending_done"]),
    "[pending-to-graph] classic ordering must consume at start"
  );

  const skeletonErrorEvents = runPendingFlow("skeleton_v1", "error");
  assert(
    JSON.stringify(skeletonErrorEvents) === JSON.stringify(["analysis_begin", "analysis_error", "consume_finally", "pending_done"]),
    "[pending-to-graph] skeleton ordering must consume after async completion"
  );

  const payloadA = { kind: "text", createdAt: 10, text: "alpha" };
  const payloadB = { kind: "text", createdAt: 11, text: "beta" };
  const keyA = buildPendingAnalysisPayloadKey(payloadA);
  const keyB = buildPendingAnalysisPayloadKey(payloadB);
  assert(keyA !== keyB, "[pending-to-graph] pending key must differ across submissions");
  assert(
    shouldResetPendingConsumeLatch(keyA, keyB) === true,
    "[pending-to-graph] latch must reset when pending payload identity changes"
  );

  let applyCalls = 0;
  applyTopologyToGraphState(
    { nodes: [{ id: "n1" }], links: [] },
    () => {
      applyCalls += 1;
    }
  );
  assert(applyCalls === 1, "[pending-to-graph] topology apply must remain atomic single call");

  console.log("[pending-to-graph] executed transition policy contracts valid");
  console.log("[pending-to-graph] done");
}

try {
  run();
} catch (error) {
  console.error(`[pending-to-graph] failed: ${error.message}`);
  process.exitCode = 1;
}
