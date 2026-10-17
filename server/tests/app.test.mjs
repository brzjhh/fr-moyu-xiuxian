import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../dist/app.js";
import { hashPassword } from "../dist/security.js";

function character(stateVersion = 1, state = {}) {
  return {
    id: "10",
    name: state.characterName || "青岚",
    stateVersion,
    state,
    updatedAt: "2026-10-17T00:00:00.000Z",
  };
}

class MemoryStore {
  constructor() {
    this.account = null;
    this.character = character();
    this.sessions = new Map();
    this.unavailable = false;
  }

  async check() {
    if (this.unavailable)
      throw new Error("postgresql://secret.invalid/private");
  }

  async register(input) {
    this.character = character(1, input.initialState);
    this.account = {
      user: { id: "1", username: input.username },
      character: this.character,
      passwordHash: input.passwordHash,
    };
    this.sessions.set(input.sessionTokenHash, input.sessionExpiresAt);
    return { user: this.account.user, character: this.character };
  }

  async findAccountByUsername(username) {
    return this.account?.user.username === username ? this.account : null;
  }

  async createSession(_userId, tokenHash, expiresAt) {
    this.sessions.set(tokenHash, expiresAt);
  }

  async findSession(tokenHash, currentTime) {
    const expiresAt = this.sessions.get(tokenHash);
    if (!this.account || !expiresAt || expiresAt <= currentTime) return null;
    return {
      user: this.account.user,
      character: this.character,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async deleteSession(tokenHash) {
    this.sessions.delete(tokenHash);
  }

  async updateCharacter(_userId, update) {
    if (update.expectedVersion !== this.character.stateVersion) {
      return { updated: false, character: this.character };
    }
    this.character = character(this.character.stateVersion + 1, update.state);
    if (this.account) this.account.character = this.character;
    return { updated: true, character: this.character };
  }

  async close() {}
}

const now = () => new Date("2026-10-17T00:00:00.000Z");

test("health returns ok when PostgreSQL is reachable", async () => {
  const app = buildApp({ store: new MemoryStore(), now });
  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    database: "ok",
    service: "chentu-server",
    status: "ok",
    time: "2026-10-17T00:00:00.000Z",
  });
  await app.close();
});

test("health returns 503 without leaking database errors", async () => {
  const store = new MemoryStore();
  store.unavailable = true;
  const app = buildApp({ store, now });
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

test("registers an account and returns an authenticated profile", async () => {
  const store = new MemoryStore();
  const app = buildApp({ store, now, sessionTtlMs: 60_000 });
  const registration = await app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload: {
      username: "Cultivator_1",
      password: "correct-horse",
      invitationCode: "invite-123",
      characterName: "青岚",
    },
  });

  assert.equal(registration.statusCode, 201);
  const body = registration.json();
  assert.equal(body.user.username, "cultivator_1");
  assert.equal(body.character.stateVersion, 1);
  assert.equal(body.character.state.inventory.spiritStone, 20);
  assert.equal(body.expiresAt, "2026-10-17T00:01:00.000Z");

  const profile = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: `Bearer ${body.token}` },
  });
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().user.username, "cultivator_1");
  await app.close();
});

test("logs in without revealing which credential was wrong", async () => {
  const store = new MemoryStore();
  store.account = {
    user: { id: "1", username: "cultivator" },
    character: store.character,
    passwordHash: await hashPassword("correct-horse"),
  };
  const app = buildApp({ store, now });

  const rejected = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { username: "cultivator", password: "wrong-pass" },
  });
  assert.equal(rejected.statusCode, 401);
  assert.equal(rejected.json().error.code, "invalid_credentials");

  const accepted = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { username: "cultivator", password: "correct-horse" },
  });
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.json().user.id, "1");
  assert.ok(accepted.json().token);
  await app.close();
});

test("updates cloud saves and rejects stale state versions", async () => {
  const store = new MemoryStore();
  const app = buildApp({ store, now });
  const registration = await app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload: {
      username: "cultivator",
      password: "correct-horse",
      invitationCode: "invite-123",
      characterName: "青岚",
    },
  });
  const registered = registration.json();
  const state = {
    ...registered.character.state,
    cultivation: 12,
    totalCultivation: 12,
  };

  const updated = await app.inject({
    method: "PUT",
    url: "/v1/save",
    headers: { authorization: `Bearer ${registered.token}` },
    payload: { stateVersion: 1, state },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().character.stateVersion, 2);
  assert.equal(updated.json().character.state.cultivation, 12);

  const conflict = await app.inject({
    method: "PUT",
    url: "/v1/save",
    headers: { authorization: `Bearer ${registered.token}` },
    payload: { stateVersion: 1, state },
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().error.code, "save_conflict");
  assert.equal(conflict.json().character.stateVersion, 2);
  await app.close();
});

test("logout invalidates the bearer session", async () => {
  const store = new MemoryStore();
  const app = buildApp({ store, now });
  const registration = await app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload: {
      username: "cultivator",
      password: "correct-horse",
      invitationCode: "invite-123",
      characterName: "青岚",
    },
  });
  const token = registration.json().token;
  const logout = await app.inject({
    method: "POST",
    url: "/v1/auth/logout",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(logout.statusCode, 204);

  const profile = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(profile.statusCode, 401);
  await app.close();
});
