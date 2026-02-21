/* eslint-disable no-console */

import guardModule from "../dist/llm/analyze/skeletonModeGuards.js";
import routeModule from "../dist/routes/llmAnalyzeRoute.js";
import seedPolicyModule from "../dist/llm/analyze/seedSpawnPolicy.js";

const {
  DEFAULT_ANALYZE_MODE_FLAGS,
  resolveAnalyzeRequestModeForFlags,
  isSkeletonAnalyzeModeAllowedForFlags
} = guardModule;
const { resolveAnalyzeModeGate, SERVER_ALLOW_SKELETON_V1 } = routeModule;
const { shouldSpawnSeedGraph } = seedPolicyModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  assert(
    resolveAnalyzeRequestModeForFlags(DEFAULT_ANALYZE_MODE_FLAGS) === "classic",
    "[phase33-policy-parity] frontend/shared default mode must resolve classic"
  );
  assert(
    isSkeletonAnalyzeModeAllowedForFlags(DEFAULT_ANALYZE_MODE_FLAGS) === false,
    "[phase33-policy-parity] frontend/shared default flags must block skeleton"
  );
  const backendSkeletonGate = resolveAnalyzeModeGate("skeleton_v1");
  assert(
    SERVER_ALLOW_SKELETON_V1 === false &&
      backendSkeletonGate.allowed === false &&
      backendSkeletonGate.code === "MODE_DISABLED",
    "[phase33-policy-parity] backend default gate must block skeleton with MODE_DISABLED"
  );
  const allEnabledClientFlags = {
    enableSkeletonAnalyzeMode: true,
    ackPhase3SkeletonWiringComplete: true,
    skeletonTopologyWiringEnabled: true
  };
  assert(
    resolveAnalyzeRequestModeForFlags(allEnabledClientFlags) === "skeleton_v1" &&
      isSkeletonAnalyzeModeAllowedForFlags(allEnabledClientFlags) === true,
    "[phase33-policy-parity] frontend/shared flags should allow skeleton only with full acknowledgements"
  );
  assert(
    resolveAnalyzeModeGate("classic").allowed === true,
    "[phase33-policy-parity] backend must keep classic mode allowed"
  );
  assert(
    shouldSpawnSeedGraph({
      mode: "classic",
      hasPendingAnalysis: true,
      hasPendingRestore: false,
      hasRestoredSuccessfully: false
    }) === true &&
      shouldSpawnSeedGraph({
        mode: "skeleton_v1",
        hasPendingAnalysis: true,
        hasPendingRestore: false,
        hasRestoredSuccessfully: false
      }) === false,
    "[phase33-policy-parity] seed spawn policy must preserve classic seed and block skeleton pending seed"
  );

  console.log("[phase33-policy-parity] frontend/backend gate parity valid");
  console.log("[phase33-policy-parity] done");
}

run().catch((error) => {
  console.error(`[phase33-policy-parity] failed: ${error.message}`);
  process.exitCode = 1;
});

