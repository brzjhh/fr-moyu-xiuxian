import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { loadConfig } from "./config.js";
import { hashInvitationCode, normalizeInvitationCode } from "./security.js";

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000) {
    throw new Error(
      "max uses and expiry days must be integers from 1 to 10000",
    );
  }
  return parsed;
}

const code = normalizeInvitationCode(
  process.argv[2] || `CHENTU-${randomBytes(8).toString("hex")}`,
);
if (code.length < 6 || code.length > 128) {
  throw new Error("invitation code must contain 6 to 128 characters");
}
const maxUses = positiveInteger(process.argv[3], 1);
const expiryDays = positiveInteger(process.argv[4], 30);
const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

const { databaseUrl } = loadConfig();
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  await pool.query(
    `
      INSERT INTO invitation_codes (code_hash, max_uses, expires_at)
      VALUES ($1, $2, $3)
    `,
    [hashInvitationCode(code), maxUses, expiresAt],
  );
  console.log(`Invitation code: ${code}`);
  console.log(`Maximum uses: ${maxUses}`);
  console.log(`Expires at: ${expiresAt.toISOString()}`);
} finally {
  await pool.end();
}
