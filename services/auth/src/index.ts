import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { setupAuthRoutes } from './routes';

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

// Add schema validator and serializer
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Register plugins
server.register(cors, {
  origin: true, // Configured for development
  credentials: true,
});

server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

server.register(cookie, {
  secret: process.env.COOKIE_SECRET || 'super-secret-key-replace-in-prod',
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
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Auth service running on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
