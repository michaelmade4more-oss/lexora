import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function normalizePassword(password: string): Buffer {
  return Buffer.from(password.normalize('NFKC'), 'utf8');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await (scrypt as any)(normalizePassword(password), salt, KEY_LENGTH, SCRYPT_OPTIONS)) as Buffer;
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [algorithm, n, r, p, saltEncoded, hashEncoded] = encoded.split('$');
    if (algorithm !== 'scrypt' || !n || !r || !p || !saltEncoded || !hashEncoded) return false;
    const salt = Buffer.from(saltEncoded, 'base64url');
    const expected = Buffer.from(hashEncoded, 'base64url');
    const actual = (await (scrypt as any)(normalizePassword(password), salt, expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 })) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

export function hashRecoveryToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}

export function createRecoveryToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRecoveryToken(token) };
}

export function validatePasswordPolicy(password: string): string | null {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) return 'invalid_password';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return 'invalid_password';
  return null;
}

export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
