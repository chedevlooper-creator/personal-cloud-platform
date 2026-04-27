import { describe, expect, it } from 'vitest';
import { maskProviderKey, toProviderCredentialResponse } from '../routes/profile';

describe('provider credential responses', () => {
  it('masks plaintext keys without returning the full secret', () => {
    expect(maskProviderKey('openai', 'sk-live-secret-1234')).toBe('openai-****1234');
  });

  it('maps provider credential rows without encrypted material', () => {
    const response = toProviderCredentialResponse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      provider: 'openai',
      label: 'Work key',
      encryptedKey: 'ciphertext',
      iv: 'iv',
      authTag: 'tag',
      keyVersion: 'v1',
      lastUsedAt: null,
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      revokedAt: null,
      metadata: { keySuffix: '1234' },
    });

    expect(response).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      provider: 'openai',
      label: 'Work key',
      maskedKey: 'openai-****1234',
      lastUsedAt: null,
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
    });
    expect(response).not.toHaveProperty('encryptedKey');
    expect(response).not.toHaveProperty('iv');
    expect(response).not.toHaveProperty('authTag');
  });

  it('does not derive masks from ciphertext for legacy rows without metadata', () => {
    const response = toProviderCredentialResponse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      provider: 'anthropic',
      label: null,
      encryptedKey: 'ciphertext-ending-9999',
      iv: 'iv',
      authTag: 'tag',
      keyVersion: 'v1',
      lastUsedAt: null,
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      revokedAt: null,
      metadata: null,
    });

    expect(response.maskedKey).toBe('anthropic-****');
  });
});
