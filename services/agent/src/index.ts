import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import {
  createApiErrorHandler,
  createCorsOptions,
  createCorrelationIdGenerator,
  registerObservability,
  createHealthRoute,
  initTracing,
} from '@pcp/shared';
import { checkDbHealth } from '@pcp/db/src/client';
import { setupAgentRoutes } from './routes';
import { env } from './env';

initTracing('agent');

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
registerObservability(server, { serviceName: 'agent' });

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

server.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5,
    fields: 4,
  },
});

server.register(createHealthRoute(checkDbHealth));

import { setupAutomationRoutes } from './routes/automation';
import { setupNotificationRoutes } from './routes/notifications';
import { setupPersonasRoutes } from './routes/personas';
import { setupSkillsRoutes } from './routes/skills';
import { setupChannelsRoutes } from './routes/channels';
import { setupAutomationWorker } from './automation/queue';
import { AgentOrchestrator } from './orchestrator';

const start = async () => {
  try {
    server.register(setupAgentRoutes, { prefix: '/v1' });
    server.register(setupAutomationRoutes, { prefix: '/v1' });
    server.register(setupNotificationRoutes, { prefix: '/v1' });
    server.register(setupPersonasRoutes, { prefix: '/v1' });
    server.register(setupSkillsRoutes, { prefix: '/v1' });
    server.register(setupChannelsRoutes, { prefix: '/v1' });

    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    server.log.info(`Agent service running on port ${env.PORT}`);

    // Setup Automation Worker
    const orchestrator = new AgentOrchestrator(server.log);
    await setupAutomationWorker(orchestrator, server.log);
    server.log.info('Automation worker started');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
