import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { setupBrowserRoutes } from './routes';
import { env } from './env';

const server = Fastify({
  logger: {
    transport:
      env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
});

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.register(cors, { origin: true, credentials: true });
server.register(rateLimit, { max: 100, timeWindow: '1 minute' });
server.register(cookie, { secret: env.COOKIE_SECRET, hook: 'onRequest' });

server.get('/health', async () => ({ status: 'ok', service: 'browser' }));

server.register(setupBrowserRoutes, { prefix: '/api' });

const start = async () => {
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    server.log.info(`Browser service running on port ${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
