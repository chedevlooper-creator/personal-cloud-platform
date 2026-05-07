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
  createHealthRoute,
  initTracing,
} from '@pcp/shared';
import { checkDbHealth } from '@pcp/db/src/client';
import { setupMemoryRoutes } from './routes';
import { env } from './env';

initTracing('memory');

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

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.setErrorHandler(createApiErrorHandler());
registerObservability(server, { serviceName: 'memory' });

server.addHook('onRequest', (request, reply, done) => {
  reply.header('x-correlation-id', request.id);
  done();
});

server.register(cors, {
  ...createCorsOptions(env.NODE_ENV),
});

server.register(rateLimit, { max: 100, timeWindow: '1 minute' });

server.register(cookie, {
  secret: env.COOKIE_SECRET,
  hook: 'onRequest',
});

server.register(createHealthRoute(checkDbHealth));

server.register(setupMemoryRoutes, { prefix: '/v1' });

const start = async () => {
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    server.log.info(`Memory service running on port ${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
