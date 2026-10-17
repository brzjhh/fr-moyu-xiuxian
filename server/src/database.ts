import { Pool } from "pg";

export type Database = {
  check: () => Promise<void>;
  close: () => Promise<void>;
};

export function createDatabase(connectionString: string): Database {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  });

  return {
    async check() {
      await pool.query("SELECT 1");
    },
    async close() {
      await pool.end();
    },
  };
}
