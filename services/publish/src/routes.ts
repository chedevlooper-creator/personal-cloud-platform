import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PublishService } from './service';

export const publishRoutes: FastifyPluginAsyncZod = async (app) => {
  const publishService = new PublishService();

  app.post(
    '/apps',
    {
      schema: {
        body: z.object({
          userId: z.string().uuid(),
          workspaceId: z.string().uuid(),
          name: z.string().min(1).max(255),
          subdomain: z.string().min(1).max(255),
          config: z.record(z.any()).optional(),
        }),
        response: {
          201: z.object({
            id: z.string().uuid(),
            status: z.string(),
            subdomain: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await publishService.createApp(request.body);
      return reply.code(201).send(result);
    }
  );

  app.post(
    '/apps/:id/deploy',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: z.object({
          version: z.string().min(1),
        }),
        response: {
          200: z.object({
            deploymentId: z.string().uuid(),
            status: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { version } = request.body;
      const result = await publishService.deployApp(id, version);
      return reply.code(200).send(result);
    }
  );

  app.get(
    '/apps/:id/deployments',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.array(
            z.object({
              id: z.string().uuid(),
              version: z.string(),
              status: z.string(),
              createdAt: z.string(),
            })
          ),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = await publishService.getDeployments(id);
      return reply.code(200).send(result.map(d => ({
        ...d,
        createdAt: d.createdAt.toISOString()
      })));
    }
  );

  app.delete(
    '/apps/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      await publishService.deleteApp(id);
      return reply.code(204).send();
    }
  );
};
