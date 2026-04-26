import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createRuntimeSchema, execCommandSchema, runtimeResponseSchema } from '@pcp/shared';
import { RuntimeService } from './service';
import { z } from 'zod';

export async function setupRuntimeRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const runtimeService = new RuntimeService(fastify.log);

  async function getAuthenticatedUserId(sessionId: string | undefined): Promise<string | null> {
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
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
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
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
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
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
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
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
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
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);

      await runtimeService.deleteRuntime(request.params.id, userId);
      return { success: true };
    }
  );

  // WebSocket Terminal
  server.get(
    '/runtimes/:id/terminal',
    { websocket: true },
    async (connection, request) => {
      const userId = await getAuthenticatedUserId(request.cookies.sessionId);
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
