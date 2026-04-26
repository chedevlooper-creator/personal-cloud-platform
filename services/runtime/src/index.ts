import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { setupRuntimeRoutes } from './routes';

const server = Fastify({
  logger: {
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.register(cors, {
  origin: true,
  credentials: true,
});

server.register(cookie, {
  secret: process.env.COOKIE_SECRET || 'super-secret-key-replace-in-prod',
  hook: 'onRequest',
});

server.register(websocket);

server.get('/health', async () => {
  return { status: 'ok', service: 'runtime' };
});

server.register(setupRuntimeRoutes, { prefix: '/api' });

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3003;
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Runtime service running on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
