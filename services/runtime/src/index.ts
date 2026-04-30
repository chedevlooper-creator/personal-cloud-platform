import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import {
  createApiErrorHandler,
  createCorsOptions,
  createCorrelationIdGenerator,
  registerObservability,
} from '@pcp/shared';
import { setupRuntimeRoutes } from './routes';
import { RuntimeService } from './service';
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

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.setErrorHandler(createApiErrorHandler());
registerObservability(server, { serviceName: 'runtime' });

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

server.register(websocket);

server.get('/health', async () => {
  return { status: 'ok', service: 'runtime' };
});

server.register(setupRuntimeRoutes, { prefix: '/api' });

const start = async () => {
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    server.log.info(`Runtime service running on port ${env.PORT}`);

    const runtimeService = new RuntimeService(server.log);
    setInterval(() => {
      runtimeService.checkRunningContainersHealth().catch((err) => {
        server.log.error(err, 'Runtime health check failed');
      });
    }, env.RUNTIME_HEALTH_CHECK_INTERVAL_MS);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
