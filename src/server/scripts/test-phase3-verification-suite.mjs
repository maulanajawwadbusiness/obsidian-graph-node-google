/* eslint-disable no-console */

import { spawn } from "child_process";

const PHASE3_SCRIPTS = [
  "test:knowledge-skeleton-golden-contracts",
  "test:skeleton-topology-runtime-contracts",
  "test:analysis-router-contracts",
  "test:analysis-seed-spawn-gate-contracts",
  "test:pending-to-graph-transition-contracts",
  "test:phase31-flow-guards-contracts",
  "test:llm-analyze-mode-gate-contracts",
  "test:skeleton-mode-guard-contracts"
];

function runNpmScript(scriptName) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", scriptName], {
      stdio: "inherit",
      shell: true
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function run() {
  let passCount = 0;
  for (const scriptName of PHASE3_SCRIPTS) {
    console.log(`[test:phase3] running ${scriptName}`);
    const code = await runNpmScript(scriptName);
    if (code !== 0) {
      console.error(`[test:phase3] failed at ${scriptName} with exit code ${code}`);
      console.error(`[test:phase3] summary: passed=${passCount} failed=1 total=${PHASE3_SCRIPTS.length}`);
      process.exitCode = code;
      return;
    }
    passCount += 1;
  }
  console.log(`[test:phase3] summary: passed=${passCount} failed=0 total=${PHASE3_SCRIPTS.length}`);
  console.log("[test:phase3] all phase3 verification contracts passed");
}

run().catch((error) => {
  console.error(`[test:phase3] unexpected failure: ${String(error)}`);
  process.exitCode = 1;
});
