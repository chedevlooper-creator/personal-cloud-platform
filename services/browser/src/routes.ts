import { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { browserSessionSchema, navigateSchema, clickSchema, fillSchema } from '@pcp/shared';
import { BrowserService, type BrowserSessionInfo } from './service';
import { validateSessionCookie, verifyUserExists } from './auth';
import { env } from './env';

const AUTH_BYPASS = env.AUTH_BYPASS;

function toJson(s: BrowserSessionInfo) {
  return {
    id: s.id,
    url: s.url,
    title: s.title,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    lastUsedAt: s.lastUsedAt instanceof Date ? s.lastUsedAt.toISOString() : s.lastUsedAt,
  };
}

export async function setupBrowserRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const browserService = new BrowserService(fastify.log);

  async function authUser(request: FastifyRequest): Promise<string | null> {
    if (AUTH_BYPASS) return 'local-dev-user';
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
        return verifyUserExists(headerUserId);
      }
    }
    return validateSessionCookie(request.cookies.sessionId ?? '');
  }

  function handle(err: any, reply: any, fallback = 'Internal error') {
    const status = err?.statusCode ?? 500;
    if (status === 500) fastify.log.error({ err }, 'browser route failed');
    return reply.code(status).send({ error: err?.message ?? fallback });
  }

  server.get(
    '/browser/sessions',
    {
      schema: {
        response: { 200: z.object({ sessions: z.array(browserSessionSchema) }) },
      },
    },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      return { sessions: browserService.list(userId).map(toJson) };
    },
  );

  server.post(
    '/browser/sessions',
    { schema: { response: { 201: browserSessionSchema } } },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        const s = await browserService.createSession(userId);
        return reply.code(201).send(toJson(s));
      } catch (err) {
        return handle(err, reply, 'Could not start session.');
      }
    },
  );

  server.delete(
    '/browser/sessions/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        await browserService.close(userId, request.params.id);
        return { success: true };
      } catch (err) {
        return handle(err, reply, 'Could not close session.');
      }
    },
  );

  server.post(
    '/browser/sessions/:id/navigate',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: navigateSchema,
        response: { 200: browserSessionSchema },
      },
    },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        const s = await browserService.navigate(userId, request.params.id, request.body.url);
        return toJson(s);
      } catch (err) {
        return handle(err, reply, 'Navigate failed.');
      }
    },
  );

  server.post(
    '/browser/sessions/:id/click',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: clickSchema,
        response: { 200: browserSessionSchema },
      },
    },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        const s = await browserService.click(userId, request.params.id, request.body.selector);
        return toJson(s);
      } catch (err) {
        return handle(err, reply, 'Click failed.');
      }
    },
  );

  server.post(
    '/browser/sessions/:id/fill',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: fillSchema,
        response: { 200: browserSessionSchema },
      },
    },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        const s = await browserService.fill(
          userId,
          request.params.id,
          request.body.selector,
          request.body.value,
        );
        return toJson(s);
      } catch (err) {
        return handle(err, reply, 'Fill failed.');
      }
    },
  );

  server.get(
    '/browser/sessions/:id/screenshot',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: z.object({ pngBase64: z.string() }) },
      },
    },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        return await browserService.screenshot(userId, request.params.id);
      } catch (err) {
        return handle(err, reply, 'Screenshot failed.');
      }
    },
  );

  server.get(
    '/browser/sessions/:id/extract',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({
            url: z.string(),
            title: z.string(),
            text: z.string(),
            links: z.array(z.object({ href: z.string(), text: z.string() })),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        return await browserService.extract(userId, request.params.id);
      } catch (err) {
        return handle(err, reply, 'Extract failed.');
      }
    },
  );
}
