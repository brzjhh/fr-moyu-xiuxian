import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../dist/config.js";

test("loads server configuration", () => {
  assert.deepEqual(
    loadConfig({
      DATABASE_URL: "postgresql://localhost/chentu",
      HOST: "0.0.0.0",
      PORT: "3210",
    }),
    {
      databaseUrl: "postgresql://localhost/chentu",
      host: "0.0.0.0",
      port: 3210,
    },
  );
});

test("rejects a missing database URL", () => {
  assert.throws(() => loadConfig({}), /DATABASE_URL is required/);
});

test("rejects an invalid port", () => {
  assert.throws(
    () =>
      loadConfig({
        DATABASE_URL: "postgresql://localhost/chentu",
        PORT: "70000",
      }),
    /PORT must be an integer/,
  );
});
