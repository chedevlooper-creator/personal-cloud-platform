import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { publishRoutes } from './routes';
import { env } from './env';
import { startHealthDaemon } from './health';
import { PublishService } from './service';

const envToLogger = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  production: true,
  test: false,
};

const app = Fastify({
  logger: envToLogger[env.NODE_ENV] ?? true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
app.register(cors, {
  origin: true,
  credentials: true,
});
app.register(cookie);

app.register(publishRoutes, { prefix: '/publish' });

app.get('/health', async () => {
  return { status: 'ok', service: 'publish' };
});

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Publish service listening on port ${env.PORT}`);

    if (process.env.HOSTED_SERVICE_HEALTH_DISABLED !== '1') {
      const publishService = new PublishService();
      startHealthDaemon({ publishService, logger: app.log });
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

export default app;
