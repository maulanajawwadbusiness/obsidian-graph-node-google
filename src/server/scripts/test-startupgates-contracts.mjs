/* eslint-disable no-console */

import startupGatesModule from "../dist/server/startupGates.js";

const { runStartupGates } = startupGatesModule;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const callSequence = [];
  const logs = [];

  const schema = {
    dbTarget: "x",
    tables: ["a"],
    hasSessionsUserFk: true,
    hasUsersGoogleSubUnique: true,
    hasSessionsIdUnique: true
  };

  const result = await runStartupGates({
    assertAuthSchemaReady: async () => {
      callSequence.push("assertAuthSchemaReady");
      return schema;
    },
    getPool: async () => ({
      query: async () => {
        callSequence.push("detectProfileColumnsAvailability");
        return {
          rows: [{ column_name: "display_name" }, { column_name: "username" }]
        };
      }
    }),
    logger: {
      log: (message) => {
        logs.push(String(message));
      },
      error: (_message) => {
        // no-op
      }
    }
  });

  assert(
    JSON.stringify(callSequence) === JSON.stringify(["assertAuthSchemaReady", "detectProfileColumnsAvailability"]),
    `unexpected startup call order: ${JSON.stringify(callSequence)}`
  );
  assert(result.schema === schema, "runStartupGates should return original schema object");
  assert(result.profileColumnsAvailable === true, "profileColumnsAvailable should be true for stub rows");
  assert(logs.length >= 2, "expected two startup log lines");
  assert(logs[0].startsWith("[auth-schema] ready"), "first log line should be auth-schema ready");
  assert(
    logs[1].startsWith("[auth-schema] profile_columns_available="),
    "second log line should be profile_columns_available"
  );

  console.log("[startupgates-contracts] startup order and return shape ok");
  console.log("[startupgates-contracts] startup logs order ok");
  console.log("[startupgates-contracts] done");
}

run().catch((error) => {
  console.error(`[startupgates-contracts] failed: ${error.message}`);
  process.exitCode = 1;
});
