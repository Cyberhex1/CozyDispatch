/**
 * Password hashing with PBKDF2-SHA256 via WebCrypto (Workers-safe).
 * 100k iterations is the maximum Cloudflare Workers allows for PBKDF2.
 */

export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

const encoder = new TextEncoder();

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new Error('Invalid hex string.');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Constant-time comparison (time depends only on the longer length). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Constant-time string comparison via SHA-256 digests (hides length too). */
export async function timingSafeEqualString(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b))
  ]);
  return timingSafeEqual(new Uint8Array(da), new Uint8Array(db));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, HASH_BITS);
  return new Uint8Array(bits);
}

export interface PasswordHash {
  hash: string;
  salt: string;
  iterations: number;
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return { hash: bytesToHex(hash), salt: bytesToHex(salt), iterations: PBKDF2_ITERATIONS };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = hexToBytes(stored.salt);
    expected = hexToBytes(stored.hash);
  } catch {
    return false;
  }
  const iterations = Number(stored.iterations) || PBKDF2_ITERATIONS;
  const actual = await derive(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

/** Burns the same work as a real verify so unknown emails aren't faster. */
const DUMMY: PasswordHash = { hash: '00'.repeat(32), salt: '00'.repeat(SALT_BYTES), iterations: PBKDF2_ITERATIONS };
export async function dummyVerify(password: string): Promise<void> {
  await verifyPassword(password, DUMMY);
}
