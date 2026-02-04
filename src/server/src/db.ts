import { Connector } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";

const INSTANCE_CONNECTION_NAME =
  process.env.INSTANCE_CONNECTION_NAME || "";
const DB_USER = process.env.DB_USER || "";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "";

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) return pool;

  const connector = new Connector();

  // connector will create a secure connection to Cloud SQL
  const clientOpts = await connector.getOptions({
    instanceConnectionName: INSTANCE_CONNECTION_NAME,
    ipType: "PUBLIC", // we enabled Public IP on the instance, so this works
  });

  pool = new Pool({
    ...clientOpts,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  return pool;
}
