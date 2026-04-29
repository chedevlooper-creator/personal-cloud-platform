import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, decryptOAuthToken, encryptOAuthToken } from '../encryption';

describe('AES-256-GCM Encryption', () => {
  it('should encrypt and decrypt a string correctly', () => {
    const plaintext = 'sk-my-super-secret-api-key-12345';
    const { encrypted, iv, authTag } = encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(iv).toBeDefined();
    expect(authTag).toBeDefined();

    const decrypted = decrypt(encrypted, iv, authTag);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext (random IV)', () => {
    const plaintext = 'same-key-different-ciphertext';
    const result1 = encrypt(plaintext);
    const result2 = encrypt(plaintext);

    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.iv).not.toBe(result2.iv);

    // Both should still decrypt correctly
    expect(decrypt(result1.encrypted, result1.iv, result1.authTag)).toBe(plaintext);
    expect(decrypt(result2.encrypted, result2.iv, result2.authTag)).toBe(plaintext);
  });

  it('should fail decryption with wrong IV', () => {
    const plaintext = 'test-key';
    const { encrypted, authTag } = encrypt(plaintext);
    const wrongIv = encrypt('other').iv;

    expect(() => decrypt(encrypted, wrongIv, authTag)).toThrow();
  });

  it('should fail decryption with wrong auth tag', () => {
    const plaintext = 'test-key';
    const { encrypted, iv } = encrypt(plaintext);
    const wrongTag = encrypt('other').authTag;

    expect(() => decrypt(encrypted, iv, wrongTag)).toThrow();
  });

  it('should handle empty string', () => {
    const plaintext = '';
    const { encrypted, iv, authTag } = encrypt(plaintext);
    const decrypted = decrypt(encrypted, iv, authTag);
    expect(decrypted).toBe('');
  });

  it('should handle unicode characters', () => {
    const plaintext = '🔑 API anahtarı şifreli 日本語';
    const { encrypted, iv, authTag } = encrypt(plaintext);
    const decrypted = decrypt(encrypted, iv, authTag);
    expect(decrypted).toBe(plaintext);
  });

  it('should serialize OAuth tokens in an encrypted format', () => {
    const token = 'ya29.oauth-access-token-secret';
    const encryptedToken = encryptOAuthToken(token);

    expect(encryptedToken).toMatch(/^enc:v1:/);
    expect(encryptedToken).not.toContain(token);
    expect(decryptOAuthToken(encryptedToken)).toBe(token);
  });

  it('should handle long OAuth tokens without truncation', () => {
    const token = 'token.'.repeat(400);
    const encryptedToken = encryptOAuthToken(token);

    expect(encryptedToken.length).toBeGreaterThan(1024);
    expect(decryptOAuthToken(encryptedToken)).toBe(token);
  });

  it('should reject malformed encrypted OAuth tokens', () => {
    expect(() => decryptOAuthToken('plaintext-token')).toThrow('Invalid encrypted OAuth token format');
  });
});
