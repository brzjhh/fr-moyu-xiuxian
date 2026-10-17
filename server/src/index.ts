import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./database.js";

const config = loadConfig();
const database = createDatabase(config.databaseUrl);
const app = buildApp({ checkDatabase: database.check, logger: true });

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "shutting down");
  await app.close();
  await database.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await database.close();
  process.exitCode = 1;
}
