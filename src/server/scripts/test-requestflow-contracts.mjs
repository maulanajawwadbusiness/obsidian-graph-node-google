/* eslint-disable no-console */

import requestFlowModule from "../dist/llm/requestFlow.js";

const { mapLlmErrorToStatus, mapTerminationReason, sendApiError } = requestFlowModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function testMapLlmErrorToStatus() {
  const cases = [
    { code: "bad_request", expected: 400 },
    { code: "rate_limited", expected: 429 },
    { code: "timeout", expected: 504 },
    { code: "parse_error", expected: 502 },
    { code: "unauthorized", expected: 401 },
    { code: "unknown_error", expected: 502 }
  ];

  for (const item of cases) {
    const actual = mapLlmErrorToStatus({ code: item.code, error: "x" });
    assert(actual === item.expected, `mapLlmErrorToStatus(${item.code}) expected ${item.expected}, got ${actual}`);
  }
  console.log("[requestflow-contracts] mapLlmErrorToStatus matrix ok");
}

function testMapTerminationReason() {
  const cases = [
    { status: 402, code: undefined, expected: "insufficient_rupiah" },
    { status: 429, code: undefined, expected: "rate_limited" },
    { status: 400, code: undefined, expected: "validation_error" },
    { status: 413, code: undefined, expected: "validation_error" },
    { status: 504, code: undefined, expected: "timeout" },
    { status: 502, code: "timeout", expected: "timeout" },
    { status: 502, code: "structured_output_invalid", expected: "structured_output_invalid" },
    { status: 502, code: "upstream_error", expected: "upstream_error" },
    { status: 500, code: undefined, expected: "upstream_error" },
    { status: 200, code: undefined, expected: "success" },
    { status: 418, code: undefined, expected: "upstream_error" }
  ];

  for (const item of cases) {
    const actual = mapTerminationReason(item.status, item.code);
    assert(
      actual === item.expected,
      `mapTerminationReason(${item.status}, ${String(item.code)}) expected ${item.expected}, got ${actual}`
    );
  }
  console.log("[requestflow-contracts] mapTerminationReason matrix ok");
}

function createMockResponse() {
  const steps = [];
  const headers = {};
  return {
    steps,
    headers,
    statusCode: null,
    body: null,
    setHeader(name, value) {
      steps.push(`setHeader:${name}`);
      headers[name] = value;
      return this;
    },
    status(code) {
      steps.push(`status:${code}`);
      this.statusCode = code;
      return this;
    },
    json(body) {
      steps.push("json");
      this.body = body;
      return this;
    }
  };
}

function testSendApiErrorHeaderOrder() {
  const res = createMockResponse();
  sendApiError(
    res,
    429,
    {
      ok: false,
      request_id: "req-123",
      code: "rate_limited",
      error: "too many concurrent requests"
    },
    { headers: { "Retry-After": "5" } }
  );

  assert(res.statusCode === 429, "sendApiError should set status code");
  assert(res.body && res.body.request_id === "req-123", "sendApiError should set response body");
  assert(res.headers["X-Request-Id"] === "req-123", "sendApiError should set X-Request-Id");
  assert(res.headers["Retry-After"] === "5", "sendApiError should set Retry-After");

  const idxRequestId = res.steps.indexOf("setHeader:X-Request-Id");
  const idxRetryAfter = res.steps.indexOf("setHeader:Retry-After");
  const idxStatus = res.steps.indexOf("status:429");
  const idxJson = res.steps.indexOf("json");

  assert(idxRequestId >= 0, "X-Request-Id header step missing");
  assert(idxRetryAfter >= 0, "Retry-After header step missing");
  assert(idxStatus >= 0, "status step missing");
  assert(idxJson >= 0, "json step missing");
  assert(idxRequestId < idxStatus, "X-Request-Id must be set before status/json");
  assert(idxRetryAfter < idxStatus, "Retry-After must be set before status/json");
  assert(idxStatus < idxJson, "status should occur before json");
  console.log("[requestflow-contracts] sendApiError header ordering ok");
}

function testSendApiErrorWithoutHeaders() {
  const res = createMockResponse();
  sendApiError(res, 400, {
    ok: false,
    request_id: "req-400",
    code: "bad_request",
    error: "bad payload"
  });

  assert(res.statusCode === 400, "sendApiError no-header path should set status code");
  assert(res.headers["X-Request-Id"] === "req-400", "sendApiError no-header path should set X-Request-Id");
  assert(!("Retry-After" in res.headers), "sendApiError no-header path should not set Retry-After");
  console.log("[requestflow-contracts] sendApiError default path ok");
}

function run() {
  testMapLlmErrorToStatus();
  testMapTerminationReason();
  testSendApiErrorHeaderOrder();
  testSendApiErrorWithoutHeaders();
  console.log("[requestflow-contracts] done");
}

try {
  run();
} catch (error) {
  console.error(`[requestflow-contracts] failed: ${error.message}`);
  process.exitCode = 1;
}
