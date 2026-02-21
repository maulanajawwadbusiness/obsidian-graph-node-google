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
  const nodeBindingSource = readRepoFile("src/document/nodeBinding.ts");
  const graphShellSource = readRepoFile("src/playground/GraphPhysicsPlaygroundShell.tsx");
  const errorBranchIndex = nodeBindingSource.indexOf("if (analysis.kind === 'error')");
  const skeletonApplyIndex = nodeBindingSource.indexOf("applySkeletonTopologyToRuntime(analysis.skeleton");
  const classicBranchIndex = nodeBindingSource.indexOf("if (analysis.kind === 'classic')");
  const clearEngineIndex = nodeBindingSource.indexOf("engine.clear();");

  assert(
    nodeBindingSource.includes("applySkeletonTopologyToRuntime"),
    "[pending-to-graph] skeleton apply seam must be used in analysis completion path"
  );
  assert(
    nodeBindingSource.includes("if (analysis.kind === 'classic')"),
    "[pending-to-graph] classic branch must remain explicit"
  );
  assert(
    nodeBindingSource.includes("if (analysis.kind === 'error')"),
    "[pending-to-graph] router error branch must be handled before apply"
  );
  assert(
    nodeBindingSource.includes("Applied skeleton topology"),
    "[pending-to-graph] skeleton completion log marker missing"
  );
  assert(
    errorBranchIndex >= 0 && skeletonApplyIndex >= 0 && errorBranchIndex < skeletonApplyIndex,
    "[pending-to-graph] router error handling must happen before any skeleton topology apply"
  );
  assert(
    classicBranchIndex >= 0 && skeletonApplyIndex > classicBranchIndex,
    "[pending-to-graph] skeleton apply must not execute inside classic branch"
  );
  assert(
    clearEngineIndex > skeletonApplyIndex,
    "[pending-to-graph] runtime rebuild must happen after skeleton topology apply"
  );

  assert(
    graphShellSource.includes("const shouldDelayPendingConsume = requestMode === 'skeleton_v1';"),
    "[pending-to-graph] graph shell must delay pending consume in skeleton mode"
  );
  assert(
    graphShellSource.includes("if (!shouldDelayPendingConsume)") &&
      graphShellSource.includes("if (shouldDelayPendingConsume)"),
    "[pending-to-graph] graph shell must consume pending immediately for classic and defer for skeleton"
  );
  assert(
    graphShellSource.includes("engineRef.current.nodes.size === 0 && requestMode !== 'skeleton_v1'"),
    "[pending-to-graph] zero-node analysis guard must allow skeleton mode"
  );
  assert(
    graphShellSource.includes("pendingAnalysisLatchKeyRef") &&
      graphShellSource.includes("buildPendingAnalysisPayloadKey") &&
      graphShellSource.includes("shouldResetPendingConsumeLatch"),
    "[pending-to-graph] pending latch reset must be keyed by pending payload identity"
  );
  assert(
    graphShellSource.includes("await applyAnalysisToNodes(") &&
      graphShellSource.includes("if (shouldDelayPendingConsume) {") &&
      graphShellSource.includes("consumePendingAnalysis();"),
    "[pending-to-graph] skeleton pending consume must occur after async analysis path completion"
  );
  assert(
    graphShellSource.includes("if (!shouldDelayPendingConsume)") &&
      graphShellSource.includes("consumePendingAnalysis();"),
    "[pending-to-graph] classic path must still consume pending immediately"
  );
  assert(
    graphShellSource.includes("pending_analysis_done ok=${ok}") &&
      graphShellSource.includes("pending_file_analyze_failed"),
    "[pending-to-graph] failure path must close pending-analysis loop and log completion"
  );

  console.log("[pending-to-graph] transition ordering/regression invariants valid");
  console.log("[pending-to-graph] done");
}

try {
  run();
} catch (error) {
  console.error(`[pending-to-graph] failed: ${error.message}`);
  process.exitCode = 1;
}
