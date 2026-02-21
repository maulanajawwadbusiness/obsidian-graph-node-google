/* eslint-disable no-console */

import seedSpawnPolicyModule from "../dist/llm/analyze/seedSpawnPolicy.js";

const { shouldSpawnSeedGraph } = seedSpawnPolicyModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run() {
  assert(
    shouldSpawnSeedGraph({
      mode: "classic",
      hasPendingAnalysis: false,
      hasPendingRestore: false,
      hasRestoredSuccessfully: false
    }) === true,
    "[analysis-seed-spawn-gate] classic without pending flags should spawn seed graph"
  );
  assert(
    shouldSpawnSeedGraph({
      mode: "classic",
      hasPendingAnalysis: true,
      hasPendingRestore: false,
      hasRestoredSuccessfully: false
    }) === true,
    "[analysis-seed-spawn-gate] classic pending analysis should still allow seed graph"
  );
  assert(
    shouldSpawnSeedGraph({
      mode: "skeleton_v1",
      hasPendingAnalysis: true,
      hasPendingRestore: false,
      hasRestoredSuccessfully: false
    }) === false,
    "[analysis-seed-spawn-gate] skeleton pending analysis must block seed graph"
  );
  assert(
    shouldSpawnSeedGraph({
      mode: "classic",
      hasPendingAnalysis: false,
      hasPendingRestore: true,
      hasRestoredSuccessfully: false
    }) === false,
    "[analysis-seed-spawn-gate] pending restore must block seed graph"
  );
  assert(
    shouldSpawnSeedGraph({
      mode: "classic",
      hasPendingAnalysis: false,
      hasPendingRestore: false,
      hasRestoredSuccessfully: true
    }) === false,
    "[analysis-seed-spawn-gate] restored graph must block default seed spawn"
  );

  console.log("[analysis-seed-spawn-gate] executed policy contracts valid");
  console.log("[analysis-seed-spawn-gate] done");
}

try {
  run();
} catch (error) {
  console.error(`[analysis-seed-spawn-gate] failed: ${error.message}`);
  process.exitCode = 1;
}
