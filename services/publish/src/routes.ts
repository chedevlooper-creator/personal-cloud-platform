import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PublishService } from './service';
import {
  createApiErrorResponse,
  createHostedServiceSchema,
  apiErrorResponseSchema,
  updateHostedServiceSchema,
  hostedServiceResponseSchema,
} from '@pcp/shared';
import { validateSessionUserId } from '@pcp/db/src/session';
import { FastifyReply, FastifyRequest } from 'fastify';

function sendUnauthorized(reply: FastifyReply) {
  return reply.code(401).send(createApiErrorResponse('UNAUTHORIZED', 'Unauthorized'));
}

export const publishRoutes: FastifyPluginAsyncZod = async (app) => {
  const publishService = new PublishService();

  async function getAuthenticatedUserId(request: FastifyRequest): Promise<string | null> {
    return validateSessionUserId(request.cookies.sessionId);
  }

  app.post(
    '/hosted-services',
    {
      schema: {
        body: createHostedServiceSchema,
        response: {
          201: hostedServiceResponseSchema,
          401: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return sendUnauthorized(reply);

      const service = await publishService.createService({ ...request.body, userId });
      return reply.code(201).send(service);
    },
  );

  app.get(
    '/hosted-services',
    {
      schema: {
        querystring: z.object({
          workspaceId: z.string().uuid(),
        }),
        response: {
          200: z.array(hostedServiceResponseSchema),
          401: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return sendUnauthorized(reply);

      const services = await publishService.listServices(request.query.workspaceId, userId);
      return reply.code(200).send(services);
    },
  );

  app.patch(
    '/hosted-services/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateHostedServiceSchema,
        response: {
          200: hostedServiceResponseSchema,
          401: apiErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return sendUnauthorized(reply);

      const service = await publishService.updateService(request.params.id, userId, request.body);
      return reply.code(200).send(service);
    },
  );

  app.delete(
    '/hosted-services/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return sendUnauthorized(reply);

      await publishService.deleteService(request.params.id, userId);
      return reply.code(204).send();
    },
  );

  app.post(
    '/hosted-services/:id/start',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return sendUnauthorized(reply);

      const result = await publishService.startService(request.params.id, userId);
      return reply.code(200).send(result);
    },
  );

  app.post(
    '/hosted-services/:id/stop',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return sendUnauthorized(reply);

      const result = await publishService.stopService(request.params.id, userId);
      return reply.code(200).send(result);
    },
  );

  app.post(
    '/hosted-services/:id/restart',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) return sendUnauthorized(reply);

      await publishService.stopService(request.params.id, userId);
      const result = await publishService.startService(request.params.id, userId);
      return reply.code(200).send(result);
    },
  );
};
