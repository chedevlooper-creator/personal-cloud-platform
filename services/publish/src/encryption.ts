import crypto from 'crypto';
import { env } from './env';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = Buffer.from(env.ENCRYPTION_KEY, 'utf8');

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 bytes long');
}

const ENC_PREFIX = 'enc:';

/** Returns `enc:<iv>.<authTag>.<ciphertext>` (all base64). */
export function encryptValue(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
}

/** Decrypts a value produced by `encryptValue`. Plain (non-`enc:` prefixed) input is returned as-is. */
export function decryptValue(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const parts = stored.slice(ENC_PREFIX.length).split('.');
  if (parts.length !== 3) return '';
  const [ivB64, tagB64, ctB64] = parts as [string, string, string];
  try {
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function encryptEnvVars(envVars: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(envVars)) {
    out[k] = v.startsWith(ENC_PREFIX) ? v : encryptValue(v);
  }
  return out;
}

export function decryptEnvVars(envVars: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(envVars)) {
    out[k] = decryptValue(v);
  }
  return out;
}

/** Replaces every value with a fixed mask for safe client display. */
export function redactEnvVars(envVars: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(envVars)) out[k] = '***';
  return out;
}
