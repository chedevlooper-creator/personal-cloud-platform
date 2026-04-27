import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createRuntimeSchema, execCommandSchema, runtimeResponseSchema } from '@pcp/shared';
import { RuntimeService } from './service';
import { z } from 'zod';
import { env } from './env';
import type { FastifyRequest } from 'fastify';

export async function setupRuntimeRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const runtimeService = new RuntimeService(fastify.log);

  async function getAuthenticatedUserId(request: FastifyRequest): Promise<string | null> {
    const auth = request.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length).trim();
      const headerUserId = request.headers['x-user-id'];
      if (
        token &&
        token === env.INTERNAL_SERVICE_TOKEN &&
        typeof headerUserId === 'string' &&
        headerUserId.length > 0
      ) {
        return headerUserId;
      }
    }
    const sessionId = request.cookies.sessionId;
    if (!sessionId) return null;
    return runtimeService.validateUserFromCookie(sessionId);
  }

  server.post(
    '/runtimes',
    {
      schema: {
        body: createRuntimeSchema,
        response: {
          201: runtimeResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const { workspaceId, image, options } = request.body;
      const runtime = await runtimeService.createRuntime(userId, workspaceId, image, options);
      return reply.code(201).send(runtime);
    }
  );

  server.post(
    '/runtimes/:id/start',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      await runtimeService.startRuntime(request.params.id, userId);
      return { success: true };
    }
  );

  server.post(
    '/runtimes/:id/stop',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      await runtimeService.stopRuntime(request.params.id, userId);
      return { success: true };
    }
  );

  server.post(
    '/runtimes/:id/exec',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: execCommandSchema,
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const result = await runtimeService.execCommand(request.params.id, userId, request.body.command);
      return result;
    }
  );

  server.delete(
    '/runtimes/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      await runtimeService.deleteRuntime(request.params.id, userId);
      return { success: true };
    }
  );

  // Find-or-create a running runtime for a workspace.
  server.post(
    '/runtimes/ensure',
    {
      schema: {
        body: z.object({
          workspaceId: z.string().uuid(),
          image: z.string().default('node:20-bookworm-slim'),
          options: z
            .object({
              cpu: z.number().optional(),
              memory: z.number().optional(),
              env: z.record(z.string()).optional(),
            })
            .optional(),
        }),
        response: {
          200: runtimeResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      const { workspaceId, image, options } = request.body;
      const runtime = await runtimeService.ensureRuntimeForWorkspace(
        userId,
        workspaceId,
        image,
        options ?? {},
      );
      return runtime;
    },
  );

  // WebSocket Terminal
  server.get(
    '/runtimes/:id/terminal',
    { websocket: true },
    async (connection, request) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) {
        connection.socket.send(JSON.stringify({ error: 'Unauthorized' }));
        connection.socket.close();
        return;
      }

      const { id } = request.params as any;
      try {
        const stream = await runtimeService.attachTerminal(id, userId);
        
        // Pipe stream to socket
        stream.on('data', (data) => {
          connection.socket.send(data.toString());
        });

        connection.socket.on('message', (message: Buffer) => {
          stream.write(message.toString());
        });

        connection.socket.on('close', () => {
          stream.end();
        });

        stream.on('end', () => {
          connection.socket.close();
        });

        stream.on('error', (err) => {
          request.log.error(err, 'Terminal stream error');
          connection.socket.close();
        });
      } catch (err) {
        request.log.error(err, 'Failed to attach terminal');
        connection.socket.send(JSON.stringify({ error: 'Failed to attach terminal' }));
        connection.socket.close();
      }
    }
  );
}
