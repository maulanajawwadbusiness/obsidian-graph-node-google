/* eslint-disable no-console */

import { once } from "events";
import express from "express";
import betaCapsRoutesModule from "../dist/routes/betaCapsRoutes.js";

const { registerBetaCapsRoutes } = betaCapsRoutesModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const app = express();
  let queryCalls = 0;

  const getPool = async () => ({
    query: async () => {
      queryCalls += 1;
      return { rows: [{ used_words: 321 }] };
    }
  });

  registerBetaCapsRoutes(app, {
    getPool,
    requireAuth: (_req, res, next) => {
      res.locals.user = { id: "42" };
      next();
    },
    getUserId: (user) => String(user.id),
    isBetaCapsModeEnabled: () => true
  });

  app.get("/__beta-disabled", (_req, res) => {
    res.locals.user = { id: "42" };
    res.json({ ok: true });
  });

  const disabledApp = express();
  registerBetaCapsRoutes(disabledApp, {
    getPool,
    requireAuth: (_req, res, next) => {
      res.locals.user = { id: "42" };
      next();
    },
    getUserId: (user) => String(user.id),
    isBetaCapsModeEnabled: () => false
  });

  const serverEnabled = app.listen(0);
  await once(serverEnabled, "listening");
  const enabledAddress = serverEnabled.address();
  if (!enabledAddress || typeof enabledAddress === "string") {
    throw new Error("failed to resolve enabled server address");
  }
  const baseEnabled = `http://127.0.0.1:${enabledAddress.port}`;

  const serverDisabled = disabledApp.listen(0);
  await once(serverDisabled, "listening");
  const disabledAddress = serverDisabled.address();
  if (!disabledAddress || typeof disabledAddress === "string") {
    throw new Error("failed to resolve disabled server address");
  }
  const baseDisabled = `http://127.0.0.1:${disabledAddress.port}`;

  try {
    const enabledRes = await fetch(`${baseEnabled}/api/beta/usage/today`);
    assert(enabledRes.status === 200, `enabled route expected 200, got ${enabledRes.status}`);
    const enabledJson = await enabledRes.json();
    assert(enabledJson.caps_enabled === true, "enabled route caps_enabled must be true");
    assert(typeof enabledJson.used_words === "number", "enabled route used_words must be number");
    assert(typeof enabledJson.remaining_words === "number", "enabled route remaining_words must be number");
    assert(queryCalls === 1, `enabled route expected one DB query, got ${queryCalls}`);
    console.log("[beta-caps-usage-contracts] enabled contract ok");

    const disabledRes = await fetch(`${baseDisabled}/api/beta/usage/today`);
    assert(disabledRes.status === 200, `disabled route expected 200, got ${disabledRes.status}`);
    const disabledJson = await disabledRes.json();
    assert(disabledJson.caps_enabled === false, "disabled route caps_enabled must be false");
    assert(disabledJson.used_words === 0, "disabled route used_words must be 0");
    assert(typeof disabledJson.daily_limit === "number", "disabled route daily_limit must be number");
    console.log("[beta-caps-usage-contracts] disabled contract ok");
  } finally {
    await new Promise((resolve, reject) => {
      serverEnabled.close((error) => {
        if (error) reject(error);
        else resolve(null);
      });
    });
    await new Promise((resolve, reject) => {
      serverDisabled.close((error) => {
        if (error) reject(error);
        else resolve(null);
      });
    });
  }
}

run()
  .then(() => {
    console.log("[beta-caps-usage-contracts] done");
  })
  .catch((error) => {
    console.error(`[beta-caps-usage-contracts] failed: ${error.message}`);
    process.exitCode = 1;
  });
