import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import {
  createApiErrorHandler,
  createCorsOptions,
  createCorrelationIdGenerator,
  registerObservability,
} from '@pcp/shared';
import { setupAuthRoutes } from './routes';
import { env } from './env';

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

server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

server.register(cookie, {
  secret: env.COOKIE_SECRET,
  hook: 'onRequest',
});

// Health check
server.get('/health', async () => {
  return { status: 'ok', service: 'auth' };
});

// Register routes
server.register(setupAuthRoutes, { prefix: '/auth' });

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
