import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { buildApp } from "../dist/app.js";
import { createDatabase } from "../dist/database.js";
import { hashInvitationCode } from "../dist/security.js";

test(
  "PostgreSQL persists registration, sessions, and versioned cloud saves",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const suffix = randomBytes(6).toString("hex");
    const username = `ci_${suffix}`;
    const invitationCode = `CI-${suffix}`;
    const invitationHash = hashInvitationCode(invitationCode);
    const admin = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
    });
    const store = createDatabase(process.env.DATABASE_URL);
    const app = buildApp({ store });

    try {
      await admin.query(
        "INSERT INTO invitation_codes (code_hash, max_uses) VALUES ($1, 1)",
        [invitationHash],
      );
      const registration = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          username,
          password: "integration-password",
          invitationCode,
          characterName: "云岚",
        },
      });
      assert.equal(registration.statusCode, 201, registration.body);
      const registered = registration.json();

      const saved = await app.inject({
        method: "PUT",
        url: "/v1/save",
        headers: { authorization: `Bearer ${registered.token}` },
        payload: {
          stateVersion: 1,
          state: {
            ...registered.character.state,
            cultivation: 25,
            totalCultivation: 25,
          },
        },
      });
      assert.equal(saved.statusCode, 200, saved.body);
      assert.equal(saved.json().character.stateVersion, 2);

      const rows = await admin.query(
        `
          SELECT u.username, c.state_version, c.cultivation, s.token_hash
          FROM users u
          JOIN characters c ON c.user_id = u.id
          JOIN sessions s ON s.user_id = u.id
          WHERE u.username = $1
        `,
        [username],
      );
      assert.equal(rows.rows[0].state_version, 2);
      assert.equal(Number(rows.rows[0].cultivation), 25);
      assert.notEqual(rows.rows[0].token_hash, registered.token);
      assert.match(rows.rows[0].token_hash, /^[a-f0-9]{64}$/);
    } finally {
      await app.close();
      await store.close();
      await admin.query("DELETE FROM users WHERE username = $1", [username]);
      await admin.query("DELETE FROM invitation_codes WHERE code_hash = $1", [
        invitationHash,
      ]);
      await admin.end();
    }
  },
);
