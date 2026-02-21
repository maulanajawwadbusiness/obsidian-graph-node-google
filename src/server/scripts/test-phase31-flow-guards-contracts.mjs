/* eslint-disable no-console */

import flowGuardsModule from "../dist/llm/analyze/analysisFlowGuards.js";

const {
  isStaleAnalysisResult,
  buildPendingAnalysisPayloadKey,
  shouldResetPendingConsumeLatch,
  __resetPendingKeyComputeCountForTests,
  __getPendingKeyComputeCountForTests
} = flowGuardsModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runStaleChecks() {
  assert(
    isStaleAnalysisResult("doc-a", "doc-b") === true,
    "[phase31-flow-guards] stale mismatch must be treated as stale"
  );
  assert(
    isStaleAnalysisResult("doc-a", "doc-a") === false,
    "[phase31-flow-guards] matching doc ids must be active"
  );
  assert(
    isStaleAnalysisResult("doc-a", null) === true,
    "[phase31-flow-guards] null current doc id must be treated as stale"
  );

  const activeDocId = "doc-run-2";
  const run1DocId = "doc-run-1";
  const run2DocId = "doc-run-2";
  assert(
    isStaleAnalysisResult(run1DocId, activeDocId) === true,
    "[phase31-flow-guards] late run1 result must be ignored after run2 becomes active"
  );
  assert(
    isStaleAnalysisResult(run2DocId, activeDocId) === false,
    "[phase31-flow-guards] active run2 result must be accepted"
  );
}

function runLatchChecks() {
  const textA = { kind: "text", createdAt: 1, text: "hello world" };
  const textB = { kind: "text", createdAt: 2, text: "hello world" };
  const textSameMsA = { kind: "text", createdAt: 50, text: "aaaaabbbbb" };
  const textSameMsB = { kind: "text", createdAt: 50, text: "zzzzzbbbbb" };
  const keyA = buildPendingAnalysisPayloadKey(textA);
  const keyB = buildPendingAnalysisPayloadKey(textB);
  assert(keyA !== keyB, "[phase31-flow-guards] distinct submissions must produce distinct keys");
  const keySameMsA = buildPendingAnalysisPayloadKey(textSameMsA);
  const keySameMsB = buildPendingAnalysisPayloadKey(textSameMsB);
  assert(
    keySameMsA !== keySameMsB,
    "[phase31-flow-guards] same timestamp and length with different content must produce different keys"
  );
  assert(
    buildPendingAnalysisPayloadKey(textA) === buildPendingAnalysisPayloadKey(textA),
    "[phase31-flow-guards] identical payload must produce stable key"
  );
  __resetPendingKeyComputeCountForTests();
  const samePayload = { kind: "text", createdAt: 99, text: "memoize-me" };
  for (let i = 0; i < 50; i += 1) {
    buildPendingAnalysisPayloadKey(samePayload);
  }
  assert(
    __getPendingKeyComputeCountForTests() === 1,
    "[phase31-flow-guards] hash should compute once for repeated identical payload identity"
  );

  let consumed = false;
  let prevKey = null;
  let nextKey = buildPendingAnalysisPayloadKey(textA);
  if (shouldResetPendingConsumeLatch(prevKey, nextKey)) consumed = false;
  prevKey = nextKey;
  consumed = true;

  nextKey = buildPendingAnalysisPayloadKey(textB);
  if (shouldResetPendingConsumeLatch(prevKey, nextKey)) consumed = false;
  assert(consumed === false, "[phase31-flow-guards] latch must reset for second warm-mount submission");
  prevKey = nextKey;

  consumed = true;
  nextKey = buildPendingAnalysisPayloadKey(null);
  if (shouldResetPendingConsumeLatch(prevKey, nextKey)) consumed = false;
  assert(consumed === false, "[phase31-flow-guards] latch must reset when pending payload clears");
}

function run() {
  runStaleChecks();
  runLatchChecks();
  console.log("[phase31-flow-guards] stale + latch behavior contracts valid");
  console.log("[phase31-flow-guards] done");
}

try {
  run();
} catch (error) {
  console.error(`[phase31-flow-guards] failed: ${error.message}`);
  process.exitCode = 1;
}
