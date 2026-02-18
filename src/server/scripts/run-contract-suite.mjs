/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const CONTRACT_SCRIPTS = [
  "test:requestflow-contracts",
  "test:jsonparsers-contracts",
  "test:cors-contracts",
  "test:startupgates-contracts",
  "test:health-contracts",
  "test:auth-me-contracts",
  "test:auth-google-contracts",
  "test:profile-contracts",
  "test:beta-caps-usage-contracts",
  "test:saved-interfaces-contracts",
  "test:payments-contracts",
  "test:depsbuilder-contracts",
  "test:servermonolith-shell"
];

function loadPackageScripts() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const packageJsonPath = path.resolve(__dirname, "..", "package.json");
  const packageJsonRaw = fs.readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonRaw);
  return packageJson.scripts || {};
}

function runNpmScript(scriptName) {
  const npmCmd = "npm";
  return new Promise((resolve) => {
    const child = spawn(npmCmd, ["run", scriptName], {
      stdio: "inherit",
      shell: true
    });
    child.on("exit", (code) => {
      resolve(code ?? 1);
    });
    child.on("error", () => {
      resolve(1);
    });
  });
}

async function run() {
  const scripts = loadPackageScripts();

  for (const scriptName of CONTRACT_SCRIPTS) {
    if (!scripts[scriptName]) {
      if (scriptName === "test:requestflow-contracts") {
        console.log(`[test:contracts] skipping missing optional script: ${scriptName}`);
        continue;
      }
      console.error(`[test:contracts] missing required script: ${scriptName}`);
      process.exitCode = 1;
      return;
    }

    console.log(`[test:contracts] running ${scriptName}`);
    const code = await runNpmScript(scriptName);
    if (code !== 0) {
      console.error(`[test:contracts] failed at ${scriptName} with exit code ${code}`);
      process.exitCode = code;
      return;
    }
  }

  console.log("[test:contracts] all contract scripts passed");
}

run().catch((error) => {
  console.error(`[test:contracts] unexpected failure: ${String(error)}`);
  process.exitCode = 1;
});
