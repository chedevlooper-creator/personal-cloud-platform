import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { setupAgentRoutes } from './routes';
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

server.register(cors, {
  origin: true,
  credentials: true,
});

server.register(rateLimit, { max: 100, timeWindow: '1 minute' });

server.register(cookie, {
  secret: env.COOKIE_SECRET,
  hook: 'onRequest',
});

server.get('/health', async () => {
  return { status: 'ok', service: 'agent' };
});

import { setupAutomationRoutes } from './routes/automation';
import { setupAutomationWorker } from './automation/queue';
import { AgentOrchestrator } from './orchestrator';

const start = async () => {
  try {
    server.register(setupAgentRoutes, { prefix: '/api' });
    server.register(setupAutomationRoutes, { prefix: '/api' });

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
