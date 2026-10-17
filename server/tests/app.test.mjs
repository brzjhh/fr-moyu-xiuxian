import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../dist/app.js";

test("health returns ok when PostgreSQL is reachable", async () => {
  const app = buildApp({ checkDatabase: async () => undefined });
  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.database, "ok");
  assert.match(body.time, /^\d{4}-\d{2}-\d{2}T/);
  await app.close();
});

test("health returns 503 without leaking database errors", async () => {
  const app = buildApp({
    checkDatabase: async () => {
      throw new Error("postgresql://secret@example.invalid/private");
    },
  });
  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    database: "unavailable",
    service: "chentu-server",
    status: "unavailable",
  });
  assert.doesNotMatch(response.body, /secret/);
  await app.close();
});
