import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createRuntimeSchema, execCommandSchema, runtimeResponseSchema, sendApiError } from '@pcp/shared';
import { RuntimeService } from './service';
import { z } from 'zod';
import { env } from './env';
import type { FastifyRequest } from 'fastify';
import { resolveAuthenticatedUserId } from '@pcp/db/src/auth-request';

type RuntimeTerminalParams = {
  id: string;
};

export async function setupRuntimeRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const runtimeService = new RuntimeService(fastify.log);

  async function getAuthenticatedUserId(request: FastifyRequest): Promise<string | null> {
    return resolveAuthenticatedUserId(request, {
      internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
    });
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
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

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
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

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
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

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
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

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
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

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
          image: z.string().default('node:20-alpine'),
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
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');

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

      const { id } = request.params as RuntimeTerminalParams;
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
