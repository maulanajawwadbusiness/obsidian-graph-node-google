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

async function run() {
  const analyzeModeSource = readRepoFile("src/ai/analyzeMode.ts");
  const skeletonAnalyzerSource = readRepoFile("src/ai/skeletonAnalyzer.ts");

  assert(
    analyzeModeSource.includes("const SKELETON_TOPOLOGY_WIRING_ENABLED = false;"),
    "[skeleton-mode-guard] topology wiring guard constant missing"
  );
  assert(
    analyzeModeSource.includes("export function resolveAnalyzeRequestModeForFlags"),
    "[skeleton-mode-guard] resolveAnalyzeRequestModeForFlags helper missing"
  );
  assert(
    analyzeModeSource.includes("export function isSkeletonAnalyzeModeAllowed"),
    "[skeleton-mode-guard] isSkeletonAnalyzeModeAllowed helper missing"
  );
  assert(
    skeletonAnalyzerSource.includes("resolveAnalyzeRequestMode"),
    "[skeleton-mode-guard] skeletonAnalyzer must use centralized mode resolver"
  );
  assert(
    skeletonAnalyzerSource.includes("isSkeletonAnalyzeModeAllowed"),
    "[skeleton-mode-guard] skeletonAnalyzer must enforce centralized guard"
  );
  assert(
    !skeletonAnalyzerSource.includes('mode: "skeleton_v1"'),
    "[skeleton-mode-guard] hardcoded skeleton_v1 mode bypass detected"
  );
  assert(
    skeletonAnalyzerSource.includes('"mode_guard_blocked"'),
    "[skeleton-mode-guard] explicit mode guard error code missing"
  );

  console.log("[skeleton-mode-guard-contracts] mode seam guard invariants valid");
  console.log("[skeleton-mode-guard-contracts] done");
}

run().catch((error) => {
  console.error(`[skeleton-mode-guard-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
