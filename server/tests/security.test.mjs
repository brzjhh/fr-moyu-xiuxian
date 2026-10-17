import assert from "node:assert/strict";
import test from "node:test";
import {
  hashInvitationCode,
  hashPassword,
  verifyPassword,
} from "../dist/security.js";

test("password hashes verify without storing the plaintext password", async () => {
  const password = "correct-horse-battery-staple";
  const encoded = await hashPassword(password);

  assert.match(encoded, /^scrypt\$/);
  assert.doesNotMatch(encoded, new RegExp(password));
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword("wrong-password", encoded), false);
  assert.equal(await verifyPassword(password, "invalid"), false);
});

test("invitation codes are case-insensitive and trimmed", () => {
  assert.equal(
    hashInvitationCode(" invite-123 "),
    hashInvitationCode("INVITE-123"),
  );
});
