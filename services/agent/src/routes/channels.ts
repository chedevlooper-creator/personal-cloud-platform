import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '@pcp/db/src/client';
import { channelLinks, auditLogs, workspaces } from '@pcp/db/src/schema';
import { and, eq, isNull } from 'drizzle-orm';
import {
  channelLinkResponseSchema,
  createChannelLinkSchema,
  updateChannelLinkSchema,
  sendApiError,
} from '@pcp/shared';
import { AgentOrchestrator } from '../orchestrator';
import { TelegramAdapter } from '../channels/telegram';
import { handleIncoming } from '../channels/router';
import { env } from '../env';
import { createAuthMiddleware } from '@pcp/shared';
import { validateSessionUserId } from '@pcp/db/src/session';

type TelegramWebhookUpdate = {
  message?: {
    text?: string;
    chat?: { id?: string | number };
    from?: {
      id?: string | number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
};

/**
 * Channel routes: CRUD for channel_links + Telegram webhook receiver.
 */
export async function setupChannelsRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const orchestrator = new AgentOrchestrator(fastify.log);
  const telegram = TelegramAdapter.fromEnv();

  const getUserId = createAuthMiddleware({
    authBypass: env.AUTH_BYPASS,
    validateSession: validateSessionUserId,
  });

  async function assertWorkspaceOwned(workspaceId: string | null | undefined, userId: string) {
    if (!workspaceId) return true;
    const workspace = await db.query.workspaces.findFirst({
      where: and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.userId, userId),
        isNull(workspaces.deletedAt),
      ),
    });
    return Boolean(workspace);
  }

  // List my channel links
  server.get(
    '/channels/links',
    {
      schema: {
        response: { 200: z.object({ links: z.array(channelLinkResponseSchema) }) },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      const rows = await db.query.channelLinks.findMany({
        where: eq(channelLinks.userId, userId),
        orderBy: (l, { desc: d }) => [d(l.createdAt)],
      });
      return { links: rows };
    },
  );

  server.post(
    '/channels/links',
    { schema: { body: createChannelLinkSchema, response: { 201: channelLinkResponseSchema } } },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      if (!(await assertWorkspaceOwned(request.body.workspaceId, userId))) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'Workspace not found');
      }

      const existing = await db.query.channelLinks.findFirst({
        where: and(
          eq(channelLinks.channel, request.body.channel),
          eq(channelLinks.externalId, request.body.externalId),
        ),
      });
      if (existing) {
        return sendApiError(reply, 409, 'CONFLICT', 'This external account is already linked.');
      }

      const [row] = await db
        .insert(channelLinks)
        .values({
          userId,
          channel: request.body.channel,
          externalId: request.body.externalId,
          label: request.body.label ?? null,
          workspaceId: request.body.workspaceId ?? null,
        })
        .returning();
      if (!row) return sendApiError(reply, 500, 'INTERNAL_ERROR', 'Failed to create link');
      try {
        await db.insert(auditLogs).values({
          userId,
          action: 'CHANNEL_LINK_CREATE',
          details: { channel: row.channel, externalId: row.externalId, linkId: row.id },
        });
      } catch {
        /* audit best-effort */
      }
      return reply.code(201).send(row);
    },
  );

  server.patch(
    '/channels/links/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateChannelLinkSchema,
        response: { 200: channelLinkResponseSchema },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      if (!(await assertWorkspaceOwned(request.body.workspaceId, userId))) {
        return sendApiError(reply, 404, 'NOT_FOUND', 'Workspace not found');
      }
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (request.body.label !== undefined) patch.label = request.body.label;
      if (request.body.workspaceId !== undefined) patch.workspaceId = request.body.workspaceId;
      if (request.body.enabled !== undefined) patch.enabled = request.body.enabled;
      const [row] = await db
        .update(channelLinks)
        .set(patch)
        .where(and(eq(channelLinks.id, request.params.id), eq(channelLinks.userId, userId)))
        .returning();
      if (!row) return sendApiError(reply, 404, 'NOT_FOUND', 'Link not found');
      return row;
    },
  );

  server.delete(
    '/channels/links/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      const result = await db
        .delete(channelLinks)
        .where(and(eq(channelLinks.id, request.params.id), eq(channelLinks.userId, userId)))
        .returning();
      if (result.length === 0) return sendApiError(reply, 404, 'NOT_FOUND', 'Link not found');
      try {
        await db.insert(auditLogs).values({
          userId,
          action: 'CHANNEL_LINK_DELETE',
          details: { linkId: request.params.id },
        });
      } catch {
        /* audit best-effort */
      }
      return { success: true };
    },
  );

  // Status: which adapters are configured (helps the UI render setup hints)
  server.get(
    '/channels/status',
    {
      schema: {
        response: {
          200: z.object({
            telegram: z.object({
              enabled: z.boolean(),
              webhookUrl: z.string().nullable(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      return {
        telegram: {
          enabled: telegram !== null,
          webhookUrl: TelegramAdapter.getWebhookUrl(),
        },
      };
    },
  );

  // Public Telegram webhook. Optional shared-secret header per Telegram Bot API
  // setWebhook `secret_token` parameter (env: TELEGRAM_WEBHOOK_SECRET).
  server.post(
    '/channels/telegram/webhook',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        body: z.any(),
      },
    },
    async (request, reply) => {
      if (!telegram) return sendApiError(reply, 500, 'INTERNAL_ERROR', 'Telegram not configured');

      const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (expectedSecret) {
        const got = request.headers['x-telegram-bot-api-secret-token'];
        if (got !== expectedSecret) {
          return sendApiError(reply, 401, 'UNAUTHORIZED', 'Bad secret');
        }
      }

      const update = request.body as TelegramWebhookUpdate;
      const m = update?.message;
      if (!m || !m.text || !m.chat?.id) {
        return reply.send({ ok: true, ignored: true });
      }

      const chatId = String(m.chat.id);
      const fromId = m.from?.id ? String(m.from.id) : chatId;
      const display =
        m.from?.username ||
        [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') ||
        undefined;

      // ACK immediately; do the work async so Telegram doesn't retry on slow loops.
      void handleIncoming(
        {
          channel: 'telegram',
          externalUserId: fromId,
          externalThreadId: chatId,
          body: m.text,
          externalDisplayName: display,
          receivedAt: new Date(),
        },
        orchestrator,
        telegram,
        fastify.log,
      ).catch((err) => fastify.log.error({ err }, 'Telegram handleIncoming failed'));

      return reply.send({ ok: true });
    },
  );
}
