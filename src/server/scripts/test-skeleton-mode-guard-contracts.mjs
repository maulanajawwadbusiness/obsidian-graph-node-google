/* eslint-disable no-console */

import guardModule from "../dist/llm/analyze/skeletonModeGuards.js";

const {
  DEFAULT_ANALYZE_MODE_FLAGS,
  isSkeletonAnalyzeModeAllowedForFlags,
  resolveAnalyzeRequestModeForFlags
} = guardModule;

async function run() {
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  assert(
    DEFAULT_ANALYZE_MODE_FLAGS.enableSkeletonAnalyzeMode === false &&
      DEFAULT_ANALYZE_MODE_FLAGS.ackPhase3SkeletonWiringComplete === false &&
      DEFAULT_ANALYZE_MODE_FLAGS.skeletonTopologyWiringEnabled === false,
    "[skeleton-mode-guard] all default mode guard flags must be false"
  );
  assert(
    isSkeletonAnalyzeModeAllowedForFlags(DEFAULT_ANALYZE_MODE_FLAGS) === false,
    "[skeleton-mode-guard] default flags must block skeleton mode"
  );
  assert(
    resolveAnalyzeRequestModeForFlags(DEFAULT_ANALYZE_MODE_FLAGS) === "classic",
    "[skeleton-mode-guard] resolver must force classic under default flags"
  );
  const partialFlags = {
    enableSkeletonAnalyzeMode: true,
    ackPhase3SkeletonWiringComplete: true,
    skeletonTopologyWiringEnabled: false
  };
  assert(
    isSkeletonAnalyzeModeAllowedForFlags(partialFlags) === false,
    "[skeleton-mode-guard] missing topology wiring acknowledgement must still block skeleton mode"
  );
  const allEnabled = {
    enableSkeletonAnalyzeMode: true,
    ackPhase3SkeletonWiringComplete: true,
    skeletonTopologyWiringEnabled: true
  };
  assert(
    isSkeletonAnalyzeModeAllowedForFlags(allEnabled) === true &&
      resolveAnalyzeRequestModeForFlags(allEnabled) === "skeleton_v1",
    "[skeleton-mode-guard] skeleton mode should resolve only when all guards are enabled"
  );

  console.log("[skeleton-mode-guard-contracts] executed mode guard contracts valid");
  console.log("[skeleton-mode-guard-contracts] done");
}

run().catch((error) => {
  console.error(`[skeleton-mode-guard-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
