import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import {
  createApiErrorHandler,
  createCorrelationIdGenerator,
  registerObservability,
} from '@pcp/shared';
import { publishRoutes } from './routes';
import { env } from './env';
import { startHealthDaemon } from './health';
import { PublishService } from './service';

let healthDaemon: { stop: () => void } | undefined;

const envToLogger = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
    base: { service: 'publish' },
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-internal-service-token"]',
      'req.body.password',
      'req.body.token',
      'req.body.secret',
      'req.body.apiKey',
      'req.body.envVars',
    ],
  },
  production: true,
  test: false,
};

const app = Fastify({
  genReqId: createCorrelationIdGenerator(),
  logger:
    env.NODE_ENV === 'production'
      ? {
          base: { service: 'publish' },
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-internal-service-token"]',
            'req.body.password',
            'req.body.token',
            'req.body.secret',
            'req.body.apiKey',
            'req.body.envVars',
          ],
        }
      : (envToLogger[env.NODE_ENV] ?? true),
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.setErrorHandler(createApiErrorHandler());
registerObservability(app, { serviceName: 'publish' });

app.addHook('onRequest', (request, reply, done) => {
  reply.header('x-correlation-id', request.id);
  done();
});

app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
app.register(cors, {
  origin: true,
  credentials: true,
});
app.register(cookie);

app.register(publishRoutes, { prefix: '/publish' });

app.get('/health', async () => {
  return { status: 'ok', service: 'publish', uptimeSeconds: process.uptime() };
});

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Publish service listening on port ${env.PORT}`);

    if (process.env.HOSTED_SERVICE_HEALTH_DISABLED !== '1') {
      const publishService = new PublishService();
      healthDaemon = startHealthDaemon({ publishService, logger: app.log });
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  try {
    app.log.info({ signal }, 'shutdown signal received');
    healthDaemon?.stop();
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error({ err, signal }, 'shutdown failed');
    process.exit(1);
  }
}

if (require.main === module) {
  start();
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

export default app;
