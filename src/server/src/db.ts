import { Connector } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";

const rawInstanceConnectionName = process.env.INSTANCE_CONNECTION_NAME || "";
const INSTANCE_CONNECTION_NAME = rawInstanceConnectionName.replace(/\s+/g, "");
const DB_USER = process.env.DB_USER || "";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "";
const DB_CONNECT_TIMEOUT_MS = Number(process.env.DB_CONNECT_TIMEOUT_MS || 15000);

let pool: Pool | null = null;
let connector: Connector | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[db] timeout after ${timeoutMs}ms during ${label}`));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  if (!INSTANCE_CONNECTION_NAME) {
    throw new Error("INSTANCE_CONNECTION_NAME is empty");
  }
  if (rawInstanceConnectionName !== INSTANCE_CONNECTION_NAME) {
    console.warn("[db] INSTANCE_CONNECTION_NAME contained whitespace; sanitized value is used");
  }

  connector = new Connector();

  // connector will create a secure connection to Cloud SQL
  const clientOpts = await withTimeout(
    connector.getOptions({
      instanceConnectionName: INSTANCE_CONNECTION_NAME,
      ipType: "PUBLIC" as any, // we enabled Public IP on the instance, so this works
    }),
    DB_CONNECT_TIMEOUT_MS,
    "cloud-sql connector setup"
  );

  pool = new Pool({
    ...clientOpts,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
  });

  return pool;
}

export async function closePool(): Promise<void> {
  const activePool = pool;
  const activeConnector = connector;
  pool = null;
  connector = null;

  if (activePool) {
    await activePool.end();
  }
  if (activeConnector) {
    await activeConnector.close();
  }
}
