/* eslint-disable no-console */

import routerErrorModule from "../dist/llm/analyze/routerError.js";

const { normalizeRouterErrorPayload } = routerErrorModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
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
  const unknown = normalizeRouterErrorPayload(new Error("socket hangup exploded"), "analysis_failed");
  assert(
    unknown.code === "unknown_error",
    "[analysis-router-contracts] generic runtime errors must map to stable unknown_error code"
  );
  assert(
    typeof unknown.message === "string" && unknown.message.length > 0 && unknown.message.length <= 240,
    "[analysis-router-contracts] generic runtime errors must still yield bounded message"
  );

  console.log("[analysis-router-contracts] executed router error contracts valid");
  console.log("[analysis-router-contracts] done");
}

run().catch((error) => {
  console.error(`[analysis-router-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
