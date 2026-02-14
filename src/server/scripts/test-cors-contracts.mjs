/* eslint-disable no-console */

import { once } from "events";
import cors from "cors";
import express from "express";
import corsConfigModule from "../dist/server/corsConfig.js";

const { buildCorsOptions } = corsConfigModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const app = express();
  const corsOptions = buildCorsOptions({ allowedOrigins: ["https://allowed.test"] });
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));
  app.get("/ok", (_req, res) => {
    res.json({ ok: true });
  });
  app.use((err, _req, res, _next) => {
    res.status(500).json({ ok: false, error: String(err?.message || "cors_error") });
  });

  const server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("failed to resolve test server port");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const allowed = await fetch(`${baseUrl}/ok`, {
      method: "GET",
      headers: {
        Origin: "https://allowed.test"
      }
    });
    assert(allowed.status === 200, `allowed origin GET expected 200, got ${allowed.status}`);
    assert(
      allowed.headers.get("access-control-allow-origin") === "https://allowed.test",
      "allowed origin GET expected access-control-allow-origin"
    );
    assert(
      allowed.headers.get("access-control-allow-credentials") === "true",
      "allowed origin GET expected access-control-allow-credentials=true"
    );
    console.log("[cors-contracts] allowed origin GET headers ok");

    const blocked = await fetch(`${baseUrl}/ok`, {
      method: "GET",
      headers: {
        Origin: "https://blocked.test"
      }
    });
    assert(
      blocked.status < 200 || blocked.status >= 300,
      `blocked origin GET expected non-2xx, got ${blocked.status}`
    );
    assert(
      blocked.headers.get("access-control-allow-origin") === null,
      "blocked origin GET should not include access-control-allow-origin"
    );
    console.log("[cors-contracts] blocked origin GET contract ok");

    const preflight = await fetch(`${baseUrl}/ok`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://allowed.test",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type"
      }
    });
    assert(
      preflight.status === 204 || preflight.status === 200,
      `allowed preflight expected 204 or 200, got ${preflight.status}`
    );
    assert(
      preflight.headers.get("access-control-allow-origin") === "https://allowed.test",
      "allowed preflight expected access-control-allow-origin"
    );
    const allowMethods = preflight.headers.get("access-control-allow-methods") || "";
    assert(allowMethods.includes("GET"), "allowed preflight expected GET in allow methods");
    assert(allowMethods.includes("POST"), "allowed preflight expected POST in allow methods");
    assert(allowMethods.includes("OPTIONS"), "allowed preflight expected OPTIONS in allow methods");
    const allowHeaders = preflight.headers.get("access-control-allow-headers") || "";
    assert(allowHeaders.includes("Content-Type"), "allowed preflight expected Content-Type in allow headers");
    assert(allowHeaders.includes("Authorization"), "allowed preflight expected Authorization in allow headers");
    console.log("[cors-contracts] allowed preflight contract ok");
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
    console.log("[cors-contracts] done");
  })
  .catch((error) => {
    console.error(`[cors-contracts] failed: ${error.message}`);
    process.exitCode = 1;
  });
