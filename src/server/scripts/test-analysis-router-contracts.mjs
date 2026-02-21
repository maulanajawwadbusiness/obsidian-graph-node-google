/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import routerErrorModule from "../dist/llm/analyze/routerError.js";

const { normalizeRouterErrorPayload } = routerErrorModule;

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
  assert(
    nodeBindingSource.includes("new AnalysisRunError(analysis.error)"),
    "[analysis-router-contracts] nodeBinding must preserve router error payload when surfacing failures"
  );

  const unauthorized = normalizeRouterErrorPayload(new Error("unauthorized"), "analysis_failed");
  assert(
    unauthorized.code === "unauthorized" && unauthorized.message === "unauthorized",
    "[analysis-router-contracts] classic error normalization must preserve original message code"
  );
  const typed = normalizeRouterErrorPayload(
    { code: "insufficient_balance", message: "insufficient_balance", status: 402, details: { source: "billing" } },
    "analysis_failed"
  );
  assert(typed.code === "insufficient_balance", "[analysis-router-contracts] typed error code must be preserved");
  assert(typed.status === 402, "[analysis-router-contracts] typed status must be preserved");
  assert(
    typeof typed.details === "object" && typed.details && typed.details.source === "billing",
    "[analysis-router-contracts] typed details must be preserved"
  );

  console.log("[analysis-router-contracts] router seam invariants valid");
  console.log("[analysis-router-contracts] done");
}

run().catch((error) => {
  console.error(`[analysis-router-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
