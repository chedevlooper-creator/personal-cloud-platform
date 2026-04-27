import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createSnapshotSchema, snapshotResponseSchema } from '@pcp/shared';
import { WorkspaceService } from '../service';

export async function setupSnapshotRoutes(fastify: FastifyInstance, workspaceService: WorkspaceService) {
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
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const snapshot = await workspaceService.createSnapshot(
        request.params.id,
        userId,
        request.body.name,
        request.body.description
      );

      return reply.code(201).send(snapshot);
    }
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
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const snapshots = await workspaceService.getSnapshots(request.params.id, userId);
      return { snapshots };
    }
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
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      await workspaceService.restoreSnapshot(request.params.id, userId);
      return { success: true };
    }
  );
}
