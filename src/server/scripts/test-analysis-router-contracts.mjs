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
  const routerSource = readRepoFile("src/ai/analysisRouter.ts");
  const paperAnalyzerSource = readRepoFile("src/ai/paperAnalyzer.ts");
  const nodeBindingSource = readRepoFile("src/document/nodeBinding.ts");

  assert(
    routerSource.includes("resolveAnalyzeRequestMode"),
    "[analysis-router-contracts] router must own mode resolution"
  );
  assert(
    routerSource.includes("analyzeDocumentToSkeletonV1"),
    "[analysis-router-contracts] router must contain skeleton path"
  );
  assert(
    routerSource.includes('kind: "classic"') && routerSource.includes('kind: "skeleton_v1"'),
    "[analysis-router-contracts] router must expose tagged union result kinds"
  );
  assert(
    !paperAnalyzerSource.includes("resolveAnalyzeRequestMode"),
    "[analysis-router-contracts] paperAnalyzer must not branch analysis mode"
  );
  assert(
    paperAnalyzerSource.includes("mode: 'classic'"),
    "[analysis-router-contracts] paperAnalyzer must send classic mode explicitly"
  );
  assert(
    nodeBindingSource.includes("from '../ai/analysisRouter'"),
    "[analysis-router-contracts] nodeBinding must consume analysis router"
  );
  assert(
    !nodeBindingSource.includes("from '../ai/paperAnalyzer'"),
    "[analysis-router-contracts] nodeBinding must not call paperAnalyzer directly"
  );
  assert(
    nodeBindingSource.includes("runAnalysis({ text: documentText, nodeCount })"),
    "[analysis-router-contracts] nodeBinding must call runAnalysis"
  );

  console.log("[analysis-router-contracts] router seam invariants valid");
  console.log("[analysis-router-contracts] done");
}

run().catch((error) => {
  console.error(`[analysis-router-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
