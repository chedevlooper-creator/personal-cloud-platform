import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '@pcp/db/src/client';
import { notifications } from '@pcp/db/src/schema';
import { validateSessionUserId } from '@pcp/db/src/session';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '../env';
import { sendApiError, createAuthMiddleware } from '@pcp/shared';

export async function setupNotificationRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  const getAuthenticatedUserId = createAuthMiddleware({
    authBypass: env.AUTH_BYPASS,
    validateSession: validateSessionUserId,
  });

  server.get(
    '/notifications',
    {
      schema: {
        querystring: z.object({
          unreadOnly: z
            .enum(['0', '1', 'true', 'false'])
            .optional()
            .transform((v) => v === '1' || v === 'true'),
          limit: z.coerce.number().int().positive().max(200).default(50),
        }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const { unreadOnly, limit } = request.query;
      const items = await db.query.notifications.findMany({
        where: unreadOnly
          ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
          : eq(notifications.userId, userId),
        orderBy: [desc(notifications.createdAt)],
        limit,
      });

      return { notifications: items };
    },
  );

  server.get('/notifications/unread-count', async (request, reply) => {
    const userId = await getAuthenticatedUserId(request.cookies.sessionId);
    if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    return { count: rows[0]?.count ?? 0 };
  });

  server.post(
    '/notifications/:id/read',
    {
      schema: { params: z.object({ id: z.string().uuid() }) },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, request.params.id), eq(notifications.userId, userId)));

      return { success: true };
    },
  );

  server.post('/notifications/read-all', async (request, reply) => {
    const userId = await getAuthenticatedUserId(request.cookies.sessionId);
    if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    return { success: true };
  });
}
