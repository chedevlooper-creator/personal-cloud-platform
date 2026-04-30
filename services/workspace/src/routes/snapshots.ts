import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createSnapshotSchema, snapshotResponseSchema, sendApiError } from '@pcp/shared';
import { WorkspaceService } from '../service';
import { db } from '@pcp/db/src/client';
import { auditLogs } from '@pcp/db/src/schema';

async function emitAudit(
  fastify: FastifyInstance,
  userId: string | null,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({ userId, action, details });
  } catch (e) {
    fastify.log.warn({ action, err: e }, 'audit_log emit failed');
  }
}

export async function setupSnapshotRoutes(
  fastify: FastifyInstance,
  workspaceService: WorkspaceService,
) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  server.post(
    '/workspaces/:id/snapshots',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: createSnapshotSchema.omit({ workspaceId: true }),
        response: {
          201: snapshotResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await workspaceService.validateUserFromCookie(request.cookies.sessionId || '');
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const snapshot = await workspaceService.createSnapshot(
        request.params.id,
        userId,
        request.body.name,
        request.body.description,
      );

      return reply.code(201).send(snapshot);
    },
  );

  server.get(
    '/workspaces/:id/snapshots',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({
            snapshots: z.array(snapshotResponseSchema),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await workspaceService.validateUserFromCookie(request.cookies.sessionId || '');
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const snapshots = await workspaceService.getSnapshots(request.params.id, userId);
      return { snapshots };
    },
  );

  server.get(
    '/snapshots/:id/download',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await workspaceService.validateUserFromCookie(request.cookies.sessionId || '');
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const snapshot = await workspaceService.getSnapshot(request.params.id, userId);
      if (!snapshot) return sendApiError(reply, 404, 'NOT_FOUND');
      if (snapshot.status !== 'ready') return sendApiError(reply, 400, 'BAD_REQUEST');

      const buffer = await workspaceService.getSnapshotBuffer(snapshot.storageKey);
      const safeName = snapshot.name.replace(/[^a-zA-Z0-9_.-]/g, '_');

      return reply
        .header('Content-Type', 'application/gzip')
        .header('Content-Disposition', `attachment; filename="${safeName}.json.gz"`)
        .send(buffer);
    },
  );

  server.get(
    '/snapshots/usage',
    {
      schema: {
        response: {
          200: z.object({
            totalBytes: z.number(),
            count: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await workspaceService.validateUserFromCookie(request.cookies.sessionId || '');
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      return workspaceService.getUserSnapshotStorageUsage(userId);
    },
  );

  server.post(
    '/snapshots/:id/restore',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await workspaceService.validateUserFromCookie(request.cookies.sessionId || '');
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      const result = await workspaceService.restoreSnapshot(request.params.id, userId);
      await emitAudit(fastify, userId, 'SNAPSHOT_RESTORE', { snapshotId: request.params.id });
      return { success: true, ...result };
    },
  );

  server.delete(
    '/snapshots/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await workspaceService.validateUserFromCookie(request.cookies.sessionId || '');
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

      await workspaceService.deleteSnapshot(request.params.id, userId);
      await emitAudit(fastify, userId, 'SNAPSHOT_DELETE', { snapshotId: request.params.id });
      return { success: true };
    },
  );
}
