import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { publishRoutes } from './routes';

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
  logger: envToLogger[process.env.NODE_ENV as keyof typeof envToLogger] ?? true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

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
    const port = parseInt(process.env.PORT || '3005', 10);
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Publish service listening on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

export default app;
