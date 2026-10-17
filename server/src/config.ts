export type ServerConfig = {
  databaseUrl: string;
  host: string;
  port: number;
};

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return {
    databaseUrl: required(env.DATABASE_URL, "DATABASE_URL"),
    host: env.HOST?.trim() || "127.0.0.1",
    port,
  };
}
