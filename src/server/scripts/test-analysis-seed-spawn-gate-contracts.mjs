/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readRepoFile(relativePath) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fullPath = path.resolve(__dirname, "..", "..", "..", relativePath);
  return fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "");
}

function run() {
  const policySource = readRepoFile("src/playground/analysisSeedSpawnPolicy.ts");
  const shellSource = readRepoFile("src/playground/GraphPhysicsPlaygroundShell.tsx");

  assert(
    policySource.includes("hasPendingAnalysis") &&
      policySource.includes('mode === "skeleton_v1"') &&
      policySource.includes("return false;"),
    "[analysis-seed-spawn-gate] policy must block seed spawn for skeleton_v1 pending analysis"
  );
  assert(
    policySource.includes("return true;"),
    "[analysis-seed-spawn-gate] policy must preserve allowed spawn path"
  );

  assert(
    shellSource.includes("shouldSpawnSeedGraphOnInit") &&
      shellSource.includes("resolveAnalyzeRequestMode"),
    "[analysis-seed-spawn-gate] graph shell must use centralized seed-spawn policy and mode resolver"
  );
  assert(
    shellSource.includes("hasPendingAnalysis: pendingAnalysisPayload !== null"),
    "[analysis-seed-spawn-gate] shell must pass pending-analysis signal into spawn policy"
  );
  assert(
    shellSource.includes("spawnGraph(4, 1337);"),
    "[analysis-seed-spawn-gate] classic default seed spawn must remain available"
  );

  console.log("[analysis-seed-spawn-gate] mode-gated seed spawn invariants valid");
  console.log("[analysis-seed-spawn-gate] done");
}

try {
  run();
} catch (error) {
  console.error(`[analysis-seed-spawn-gate] failed: ${error.message}`);
  process.exitCode = 1;
}
