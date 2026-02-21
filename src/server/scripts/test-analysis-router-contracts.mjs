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
    unknown.code === "analysis_failed",
    "[analysis-router-contracts] generic runtime errors must use bounded fallback code"
  );
  assert(
    typeof unknown.message === "string" && unknown.message.length > 0 && unknown.message.length <= 240,
    "[analysis-router-contracts] generic runtime errors must still yield bounded message"
  );
  const unknownTyped = normalizeRouterErrorPayload(
    { code: "vendor_random_code", message: "gateway exploded", details: { trace: "abc" } },
    "analysis_failed"
  );
  assert(
    unknownTyped.code === "unknown_error",
    "[analysis-router-contracts] unknown object-shaped code must be bucketed to unknown_error"
  );
  assert(
    typeof unknownTyped.details === "object" &&
      unknownTyped.details &&
      unknownTyped.details.original_code === "vendor_random_code",
    "[analysis-router-contracts] unknown object-shaped code must preserve original_code in details"
  );
  const modeDisabled = normalizeRouterErrorPayload(
    { code: "MODE_DISABLED", message: "mode disabled", status: 400 },
    "analysis_failed"
  );
  assert(
    modeDisabled.code === "MODE_DISABLED" && modeDisabled.status === 400,
    "[analysis-router-contracts] allowlisted uppercase code must be preserved"
  );

  console.log("[analysis-router-contracts] executed router error contracts valid");
  console.log("[analysis-router-contracts] done");
}

run().catch((error) => {
  console.error(`[analysis-router-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
