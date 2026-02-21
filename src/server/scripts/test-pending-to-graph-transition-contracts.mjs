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

  console.log("[pending-to-graph] transition ordering/regression invariants valid");
  console.log("[pending-to-graph] done");
}

try {
  run();
} catch (error) {
  console.error(`[pending-to-graph] failed: ${error.message}`);
  process.exitCode = 1;
}
