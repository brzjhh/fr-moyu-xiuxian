import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

export function normalizeInvitationCode(value: string): string {
  return value.trim().toUpperCase();
}

export function hashOpaqueValue(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashInvitationCode(value: string): string {
  return hashOpaqueValue(normalizeInvitationCode(value));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [algorithm, saltValue, expectedValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltValue || !expectedValue) return false;

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(expectedValue, "base64url");
    if (salt.length !== 16 || expected.length !== SCRYPT_KEY_LENGTH)
      return false;
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
