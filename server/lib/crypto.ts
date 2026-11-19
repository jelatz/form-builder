import {
  createHash,
  createHmac,
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

/**
 * Generates a 16-character lowercase hexadecimal password (64-bit CSPRNG entropy)
 * for newly provisioned tenant administrator accounts.
 */
export function generateHexPassword(): string {
  return randomBytes(8).toString('hex');
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

/** Generates a signing secret (`whsec_<48-hex-chars>`) for outbound webhooks. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

/** Computes an HMAC-SHA256 signature (`sha256=<hex>`) over a raw JSON payload body. */
export function signWebhookPayload(secret: string, rawBody: string): string {
  const digest = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');
  return `sha256=${digest}`;
}
