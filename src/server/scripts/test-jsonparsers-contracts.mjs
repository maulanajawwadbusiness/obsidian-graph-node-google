/* eslint-disable no-console */

import { once } from "events";
import express from "express";
import jsonParsersModule from "../dist/server/jsonParsers.js";

const { applyJsonParsers } = jsonParsersModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { response, text, json };
}

async function run() {
  const app = express();
  applyJsonParsers(app, {
    savedInterfacesJsonLimit: "1kb",
    globalJsonLimit: "1kb"
  });

  app.post("/api/saved-interfaces/upsert", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/other", (_req, res) => {
    res.json({ ok: true });
  });

  app.use((err, _req, res, _next) => {
    const status = typeof err?.status === "number" ? err.status : 500;
    res.status(status).json({
      ok: false,
      error: String(err?.type || err?.message || "unhandled_error")
    });
  });

  const server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("failed to resolve test server port");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const oversizedBody = { payload: "x".repeat(2048) };

  try {
    const saved = await postJson(baseUrl, "/api/saved-interfaces/upsert", oversizedBody);
    assert(saved.response.status === 413, `saved route expected 413, got ${saved.response.status}`);
    assert(saved.json !== null, "saved route expected JSON body");
    assert(saved.json.ok === false, "saved route expected ok=false");
    assert(
      saved.json.error === "saved interface payload too large",
      `saved route expected exact error message, got ${saved.json.error}`
    );
    console.log("[jsonparsers-contracts] saved-interfaces 413 mapping ok");

    const other = await postJson(baseUrl, "/api/other", oversizedBody);
    assert(other.response.status >= 400, `other route expected non-2xx status, got ${other.response.status}`);
    const leakedCustomMessage =
      (other.json && other.json.error === "saved interface payload too large") ||
      other.text.includes("saved interface payload too large");
    assert(!leakedCustomMessage, "saved-interfaces custom 413 message leaked to non-saved route");
    console.log("[jsonparsers-contracts] non-saved route does not leak custom mapping");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve(null);
      });
    });
  }
}

run()
  .then(() => {
    console.log("[jsonparsers-contracts] done");
  })
  .catch((error) => {
    console.error(`[jsonparsers-contracts] failed: ${error.message}`);
    process.exitCode = 1;
  });
