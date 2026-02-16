/* eslint-disable no-console */

import { spawnSync } from "child_process";

const commands = [
  ["npm", ["run", "test:rupiah-contracts"]],
  ["npm", ["run", "test:payments-create-status-contracts"]],
  ["npm", ["run", "test:payments-webhook-contracts"]]
];

for (const [cmd, args] of commands) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true
  });

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    break;
  }
}
