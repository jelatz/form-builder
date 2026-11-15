import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const SCRYPT_KEY_BYTES = 64;
const PASSWORD_SALT_BYTES = 16;

/** Generates a prefixed unique entity identifier using CSPRNG UUID. */
export function createEntityId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Generates a 256-bit CSPRNG session token encoded as base64url. */
export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Computes a SHA-256 hex digest for storing session tokens at rest. */
export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/**
 * Hashes a password with a per-user 16-byte random salt using Node scrypt.
 * Format: `scrypt$<saltHex>$<derivedHex>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const derived = (await scryptAsync(
    password,
    salt,
    SCRYPT_KEY_BYTES,
  )) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

/**
 * Constant-time verification of a plaintext password against a stored scrypt hash.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) {
    return false;
  }

  try {
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const actualBuf = (await scryptAsync(
      password,
      salt,
      expectedBuf.length,
    )) as Buffer;

    if (actualBuf.length !== expectedBuf.length) {
      return false;
    }

    return timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

/** Constant-time string comparison for fixed-length hex digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
