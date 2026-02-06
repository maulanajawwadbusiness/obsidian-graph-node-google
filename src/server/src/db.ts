import { Connector } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";

const rawInstanceConnectionName = process.env.INSTANCE_CONNECTION_NAME || "";
const INSTANCE_CONNECTION_NAME = rawInstanceConnectionName.replace(/\s+/g, "");
const DB_USER = process.env.DB_USER || "";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "";

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  if (!INSTANCE_CONNECTION_NAME) {
    throw new Error("INSTANCE_CONNECTION_NAME is empty");
  }
  if (rawInstanceConnectionName !== INSTANCE_CONNECTION_NAME) {
    console.warn("[db] INSTANCE_CONNECTION_NAME contained whitespace; sanitized value is used");
  }

  const connector = new Connector();

  // connector will create a secure connection to Cloud SQL
  const clientOpts = await connector.getOptions({
    instanceConnectionName: INSTANCE_CONNECTION_NAME,
    ipType: "PUBLIC" as any, // we enabled Public IP on the instance, so this works
  });

  pool = new Pool({
    ...clientOpts,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  return pool;
}
