/* eslint-disable no-console */

import routeModule from "../dist/routes/llmAnalyzeRoute.js";

const { resolveAnalyzeModeGate, SERVER_ALLOW_SKELETON_V1 } = routeModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  assert(SERVER_ALLOW_SKELETON_V1 === false, "[llm-analyze-mode-gate-contracts] server guard must default false");

  const skeletonGate = resolveAnalyzeModeGate("skeleton_v1");
  assert(skeletonGate.allowed === false, "[llm-analyze-mode-gate-contracts] skeleton mode should be blocked by default");
  assert(skeletonGate.status === 400, "[llm-analyze-mode-gate-contracts] blocked mode should return status 400");
  assert(skeletonGate.code === "MODE_DISABLED", "[llm-analyze-mode-gate-contracts] blocked mode should use MODE_DISABLED");

  const classicGate = resolveAnalyzeModeGate("classic");
  assert(classicGate.allowed === true, "[llm-analyze-mode-gate-contracts] classic mode should remain allowed");

  console.log("[llm-analyze-mode-gate-contracts] mode gate behavior valid");
  console.log("[llm-analyze-mode-gate-contracts] done");
}

run().catch((error) => {
  console.error(`[llm-analyze-mode-gate-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
