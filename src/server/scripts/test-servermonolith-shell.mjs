/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function indexOfOrFail(haystack, needle) {
  const index = haystack.indexOf(needle);
  assert(index >= 0, `missing marker: ${needle}`);
  return index;
}

async function run() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const serverSrcDir = path.resolve(__dirname, "..", "src");

  const monolithPath = path.join(serverSrcDir, "serverMonolith.ts");
  const bootstrapPath = path.join(serverSrcDir, "server", "bootstrap.ts");
  const depsBuilderPath = path.join(serverSrcDir, "server", "depsBuilder.ts");

  const monolith = fs.readFileSync(monolithPath, "utf8");
  const bootstrap = fs.readFileSync(bootstrapPath, "utf8");
  const depsBuilder = fs.readFileSync(depsBuilderPath, "utf8");

  assert(monolith.includes("import { startServer } from \"./server/bootstrap\";"), "monolith must import bootstrap startServer");
  assert(monolith.includes("void startServer();"), "monolith must invoke startServer");

  assert(bootstrap.includes("buildRouteDeps"), "bootstrap must use buildRouteDeps");
  assert(depsBuilder.includes("export function buildRouteDeps"), "depsBuilder export missing");

  const webhookIdx = indexOfOrFail(bootstrap, "registerPaymentsWebhookRoute(app, routeDeps.paymentsWebhook);");
  const corsUseIdx = indexOfOrFail(bootstrap, "app.use(cors(corsOptions));");
  assert(webhookIdx < corsUseIdx, "webhook registration must stay before cors middleware");

  const parsersIdx = indexOfOrFail(bootstrap, "applyJsonParsers(app, {");
  const firstRouteIdx = indexOfOrFail(bootstrap, "registerHealthRoutes(app, routeDeps.health);");
  assert(parsersIdx < firstRouteIdx, "json parser seam must be applied before routes");

  const analyzeIdx = indexOfOrFail(bootstrap, "registerLlmAnalyzeRoute(app, routeDeps.llmAnalyze);");
  const payStatusIdx = indexOfOrFail(bootstrap, "registerPaymentsStatusRoute(app, routeDeps.payments);");
  const prefillIdx = indexOfOrFail(bootstrap, "registerLlmPrefillRoute(app, routeDeps.llmPrefill);");
  const chatIdx = indexOfOrFail(bootstrap, "registerLlmChatRoute(app, routeDeps.llmChat);");
  assert(analyzeIdx < payStatusIdx, "llm analyze must stay before payments status");
  assert(payStatusIdx < prefillIdx, "payments status must stay before llm prefill");
  assert(prefillIdx < chatIdx, "llm prefill must stay before llm chat");

  const gatesIdx = indexOfOrFail(bootstrap, "const startup = await runStartupGates({");
  const listenIdx = indexOfOrFail(bootstrap, "app.listen(port, () => {");
  assert(gatesIdx < listenIdx, "startup gates must run before listen");

  console.log("[servermonolith-shell] shell and bootstrap markers ok");
  console.log("[servermonolith-shell] order invariants markers ok");
  console.log("[servermonolith-shell] done");
}

run().catch((error) => {
  console.error(`[servermonolith-shell] failed: ${error.message}`);
  process.exitCode = 1;
});
