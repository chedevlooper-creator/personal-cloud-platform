import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '@pcp/db/src/client';
import { userPreferences, providerCredentials, auditLogs } from '@pcp/db/src/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  userPreferencesSchema,
  updateUserPreferencesSchema,
  providerCredentialResponseSchema,
  createProviderCredentialSchema,
} from '@pcp/shared';
import { encrypt } from '../encryption';
import { AuthService } from '../service';

type ProviderCredentialRow = typeof providerCredentials.$inferSelect;

export function maskProviderKey(provider: string, key: string): string {
  const suffix = key.slice(-4);
  return `${provider}-****${suffix}`;
}

export function toProviderCredentialResponse(credential: ProviderCredentialRow) {
  const keySuffix =
    credential.metadata &&
    typeof credential.metadata === 'object' &&
    typeof credential.metadata.keySuffix === 'string'
      ? credential.metadata.keySuffix
      : '';

  return {
    id: credential.id,
    provider: credential.provider,
    label: credential.label,
    maskedKey: keySuffix
      ? `${credential.provider}-****${keySuffix}`
      : `${credential.provider}-****`,
    lastUsedAt: credential.lastUsedAt,
    createdAt: credential.createdAt,
  };
}

export async function setupProfileRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authService = new AuthService(fastify.log);

  async function getUserId(request: any, reply: any) {
    const sessionId = request.cookies.sessionId;
    if (!sessionId) {
      reply.code(401).send({ error: 'Unauthorized' });
      return null;
    }
    const user = await authService.validateSession(sessionId);
    if (!user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return null;
    }
    return user.id;
  }

  // User Preferences
  server.get(
    '/user/preferences',
    {
      schema: {
        response: {
          200: userPreferencesSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request, reply);
      if (!userId) return;

      let prefs = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
      });

      if (!prefs) {
        // Create default preferences
        const [newPrefs] = await db.insert(userPreferences).values({ userId }).returning();
        prefs = newPrefs;
      }

      return reply.code(200).send(prefs);
    },
  );

  server.patch(
    '/user/preferences',
    {
      schema: {
        body: updateUserPreferencesSchema,
        response: {
          200: userPreferencesSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request, reply);
      if (!userId) return;

      // Ensure preferences exist
      const existing = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
      });

      if (!existing) {
        await db.insert(userPreferences).values({ userId });
      }

      const [updated] = await db
        .update(userPreferences)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId))
        .returning();

      // Log action
      await db.insert(auditLogs).values({
        userId,
        action: 'UPDATE_PREFERENCES',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] as string,
      });

      return reply.code(200).send(updated);
    },
  );

  // Provider Credentials
  server.get(
    '/user/providers',
    {
      schema: {
        response: {
          200: z.array(providerCredentialResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request, reply);
      if (!userId) return;

      const providers = await db.query.providerCredentials.findMany({
        where: and(eq(providerCredentials.userId, userId), isNull(providerCredentials.revokedAt)),
      });

      return reply.code(200).send(providers.map(toProviderCredentialResponse));
    },
  );

  server.post(
    '/user/providers',
    {
      schema: {
        body: createProviderCredentialSchema,
        response: {
          201: providerCredentialResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request, reply);
      if (!userId) return;

      const { provider, label, key } = request.body;
      const { encrypted, iv, authTag } = encrypt(key);
      const keySuffix = key.slice(-4);

      const [credential] = await db
        .insert(providerCredentials)
        .values({
          userId,
          provider,
          label,
          encryptedKey: encrypted,
          iv,
          authTag,
          metadata: { keySuffix },
        })
        .returning();

      if (!credential) throw new Error('Failed to save credential');

      await db.insert(auditLogs).values({
        userId,
        action: 'ADD_PROVIDER_CREDENTIAL',
        details: { provider },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] as string,
      });

      return reply.code(201).send({
        id: credential.id,
        provider: credential.provider,
        label: credential.label,
        maskedKey: maskProviderKey(credential.provider, key),
        lastUsedAt: credential.lastUsedAt,
        createdAt: credential.createdAt,
      });
    },
  );

  server.delete(
    '/user/providers/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request, reply);
      if (!userId) return;

      await db
        .update(providerCredentials)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(providerCredentials.id, request.params.id),
            eq(providerCredentials.userId, userId),
          ),
        );

      await db.insert(auditLogs).values({
        userId,
        action: 'REVOKE_PROVIDER_CREDENTIAL',
        details: { credentialId: request.params.id },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] as string,
      });

      return reply.code(204).send();
    },
  );
}
