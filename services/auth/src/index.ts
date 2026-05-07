import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import IORedis from 'ioredis';
import {
  createApiErrorHandler,
  createCorsOptions,
  createCorrelationIdGenerator,
  registerObservability,
  createHealthRoute,
  initTracing,
} from '@pcp/shared';
import { checkDbHealth } from '@pcp/db/src/client';
import { setupAuthRoutes } from './routes';
import { env } from './env';

initTracing('auth');

const server = Fastify({
  genReqId: createCorrelationIdGenerator(),
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

// Add schema validator and serializer
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Shared API error envelope: prevents 5xx leaks and standardizes the response shape.
server.setErrorHandler(createApiErrorHandler());
registerObservability(server, { serviceName: 'auth' });

server.addHook('onRequest', (request, reply, done) => {
  reply.header('x-correlation-id', request.id);
  done();
});

// Register plugins
server.register(cors, {
  ...createCorsOptions(env.NODE_ENV),
});

const rateLimitRedis = process.env.REDIS_URL ? new IORedis(process.env.REDIS_URL) : undefined;

server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  redis: rateLimitRedis,
});

server.register(cookie, {
  secret: env.COOKIE_SECRET,
  hook: 'onRequest',
});

// Health & readiness
server.register(createHealthRoute(checkDbHealth));

// Register routes
server.register(setupAuthRoutes, { prefix: '/v1' });

const start = async () => {
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    server.log.info(`Auth service running on port ${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
