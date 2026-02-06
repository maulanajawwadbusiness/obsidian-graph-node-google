/* eslint-disable no-console */

const BASE_URL = process.env.LLM_CONTRACT_BASE_URL || "http://localhost:8080";
const AUTH_COOKIE = process.env.LLM_CONTRACT_AUTH_COOKIE || "";
const ALLOW_INSUFFICIENT = process.env.LLM_CONTRACT_ALLOW_INSUFFICIENT === "true";

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (AUTH_COOKIE) headers.Cookie = AUTH_COOKIE;
  return headers;
}

async function fetchJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isErrorShape(json) {
  return json && json.ok === false && typeof json.code === "string";
}

async function testPaperAnalyze() {
  const payload = { text: "Short test input for analysis.", nodeCount: 2 };
  const { res, json } = await fetchJson("/api/llm/paper-analyze", payload);

  if (res.status === 401) {
    console.log("[paper-analyze] skipped: unauthorized");
    return;
  }

  if (res.status === 402 && ALLOW_INSUFFICIENT) {
    assert(isErrorShape(json), "[paper-analyze] insufficient: error shape invalid");
    console.log("[paper-analyze] ok: insufficient_rupiah error shape valid");
    return;
  }

  assert(res.ok, `[paper-analyze] status not ok: ${res.status}`);
  assert(json && json.ok === true, "[paper-analyze] ok:true missing");
  assert(typeof json.request_id === "string", "[paper-analyze] request_id missing");
  assert(json.json && typeof json.json === "object", "[paper-analyze] json object missing");
  console.log("[paper-analyze] ok: contract valid");
}

async function testPrefill() {
  const payload = { nodeLabel: "Test Node" };
  const { res, json } = await fetchJson("/api/llm/prefill", payload);

  if (res.status === 401) {
    console.log("[prefill] skipped: unauthorized");
    return;
  }

  if (res.status === 402 && ALLOW_INSUFFICIENT) {
    assert(isErrorShape(json), "[prefill] insufficient: error shape invalid");
    console.log("[prefill] ok: insufficient_rupiah error shape valid");
    return;
  }

  assert(res.ok, `[prefill] status not ok: ${res.status}`);
  assert(json && json.ok === true, "[prefill] ok:true missing");
  assert(typeof json.request_id === "string", "[prefill] request_id missing");
  assert(typeof json.prompt === "string", "[prefill] prompt missing");
  console.log("[prefill] ok: contract valid");
}

async function testChat() {
  const payload = {
    userPrompt: "Say hello in one short line.",
    context: {}
  };
  const res = await fetch(`${BASE_URL}/api/llm/chat`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload)
  });

  if (res.status === 401) {
    console.log("[chat] skipped: unauthorized");
    return;
  }

  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (res.status === 402 && ALLOW_INSUFFICIENT) {
      assert(isErrorShape(json), "[chat] insufficient: error shape invalid");
      console.log("[chat] ok: insufficient_rupiah error shape valid");
      return;
    }
    throw new Error(`[chat] status not ok: ${res.status}`);
  }

  assert(contentType.startsWith("text/plain"), "[chat] content-type not text/plain");
  assert(res.body, "[chat] response body missing");

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const { value } = await reader.read();
  reader.releaseLock();
  const chunk = value ? decoder.decode(value, { stream: false }) : "";
  assert(chunk !== null, "[chat] chunk missing");
  const trimmed = chunk.trimStart();
  assert(!trimmed.startsWith("data:"), "[chat] SSE framing detected");
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && "ok" in parsed) {
        throw new Error("[chat] JSON envelope detected");
      }
    } catch {
      // ignore parse errors; chunk may be plain text
    }
  }
  console.log("[chat] ok: contract valid");
}

async function run() {
  await testPaperAnalyze();
  await testPrefill();
  await testChat();
  console.log("[contracts] done");
}

run().catch((err) => {
  console.error(`[contracts] failed: ${err.message}`);
  process.exitCode = 1;
});
