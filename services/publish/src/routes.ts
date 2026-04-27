import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PublishService } from './service';
import { createHostedServiceSchema, updateHostedServiceSchema, hostedServiceResponseSchema } from '@pcp/shared';

export const publishRoutes: FastifyPluginAsyncZod = async (app) => {
  const publishService = new PublishService();

  app.post(
    '/hosted-services',
    {
      schema: {
        body: createHostedServiceSchema.extend({ userId: z.string().uuid() }),
        response: {
          201: hostedServiceResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const service = await publishService.createService(request.body);
      return reply.code(201).send(service as any);
    }
  );

  app.get(
    '/hosted-services',
    {
      schema: {
        querystring: z.object({
          workspaceId: z.string().uuid(),
          userId: z.string().uuid(),
        }),
        response: {
          200: z.array(hostedServiceResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const services = await publishService.listServices(request.query.workspaceId, request.query.userId);
      return reply.code(200).send(services as any);
    }
  );

  app.patch(
    '/hosted-services/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateHostedServiceSchema.extend({ userId: z.string().uuid() }),
        response: {
          200: hostedServiceResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const service = await publishService.updateService(request.params.id, request.body.userId as string, request.body);
      return reply.code(200).send(service as any);
    }
  );

  app.delete(
    '/hosted-services/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        querystring: z.object({ userId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      await publishService.deleteService(request.params.id, request.query.userId);
      return reply.code(204).send();
    }
  );

  app.post(
    '/hosted-services/:id/start',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ userId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const result = await publishService.startService(request.params.id, request.body.userId);
      return reply.code(200).send(result);
    }
  );

  app.post(
    '/hosted-services/:id/stop',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ userId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const result = await publishService.stopService(request.params.id, request.body.userId);
      return reply.code(200).send(result);
    }
  );

  app.post(
    '/hosted-services/:id/restart',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ userId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      await publishService.stopService(request.params.id, request.body.userId);
      const result = await publishService.startService(request.params.id, request.body.userId);
      return reply.code(200).send(result);
    }
  );
};
