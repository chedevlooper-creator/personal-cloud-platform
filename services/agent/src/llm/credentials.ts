import crypto from 'crypto';
import { db } from '@pcp/db/src/client';
import { providerCredentials, userPreferences } from '@pcp/db/src/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { createLLMProvider, type LLMProviderName } from './provider';
import type { LLMProvider } from './types';
import { env } from '../env';

const ALGORITHM = 'aes-256-gcm';

/**
 * Resolve a per-user `LLMProvider` based on the user's saved preferences and
 * encrypted provider credentials. Returns `null` when the user has no usable
 * configuration so the caller can fall back to the service-wide default.
 */
export async function resolveUserProvider(userId: string): Promise<{
  provider: LLMProvider;
  providerName: LLMProviderName;
  model: string | null;
} | null> {
  if (!userId) return null;

  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });

  const providerName = normalizeProviderName(prefs?.defaultProvider ?? null);
  if (!providerName) return null;

  const credential = await db.query.providerCredentials.findFirst({
    where: and(
      eq(providerCredentials.userId, userId),
      eq(providerCredentials.provider, providerName),
      isNull(providerCredentials.revokedAt),
    ),
    orderBy: [desc(providerCredentials.createdAt)],
  });

  if (!credential) return null;

  const apiKey = safeDecrypt(credential.encryptedKey, credential.iv, credential.authTag);
  if (!apiKey) return null;

  // Touch lastUsedAt fire-and-forget; never block the LLM call on this.
  db.update(providerCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(providerCredentials.id, credential.id))
    .execute()
    .catch(() => {
      /* best-effort */
    });

  const model = prefs?.defaultModel?.trim() || null;
  const overlay: NodeJS.ProcessEnv = { ...process.env, LLM_PROVIDER: providerName };
  if (providerName === 'openai') {
    overlay.OPENAI_API_KEY = apiKey;
    if (model) overlay.OPENAI_MODEL = model;
  } else if (providerName === 'anthropic') {
    overlay.ANTHROPIC_API_KEY = apiKey;
    if (model) overlay.ANTHROPIC_MODEL = model;
  } else if (providerName === 'minimax') {
    overlay.MINIMAX_API_KEY = apiKey;
    overlay.MINIMAX_TOKEN_PLAN_API_KEY = apiKey;
    if (model) overlay.MINIMAX_MODEL = model;
  }

  const provider = createLLMProvider(overlay);
  return { provider, providerName, model };
}

function normalizeProviderName(value: string | null): LLMProviderName | null {
  if (value === 'openai' || value === 'anthropic' || value === 'minimax') return value;
  return null;
}

function safeDecrypt(encrypted: string, ivBase64: string, authTagBase64: string): string | null {
  const rawKey = env.ENCRYPTION_KEY;
  if (!rawKey) return null;
  const keyBuffer = Buffer.from(rawKey, 'utf8');
  if (keyBuffer.length !== 32) return null;
  try {
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}
