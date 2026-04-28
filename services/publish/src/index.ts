import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { createApiErrorResponse, type ApiErrorCode } from '@pcp/shared';
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

app.setErrorHandler((error, request, reply) => {
  const statusCode = resolveStatusCode(error.statusCode);
  const code = resolveErrorCode(statusCode, Boolean(error.validation));
  const message =
    statusCode >= 500 ? 'Internal server error' : error.message || defaultErrorMessage(code);
  const correlationId = request.id;

  request.log[statusCode >= 500 ? 'error' : 'warn'](
    { err: error, correlationId },
    'request failed',
  );

  reply.code(statusCode).send(createApiErrorResponse(code, message, correlationId));
});

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

function resolveStatusCode(statusCode: number | undefined): number {
  if (!statusCode || statusCode < 400 || statusCode > 599) return 500;
  return statusCode;
}

function resolveErrorCode(statusCode: number, isValidationError: boolean): ApiErrorCode {
  if (isValidationError) return 'VALIDATION_ERROR';
  if (statusCode === 400) return 'BAD_REQUEST';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  return 'INTERNAL_ERROR';
}

function defaultErrorMessage(code: ApiErrorCode): string {
  if (code === 'VALIDATION_ERROR') return 'Validation failed';
  if (code === 'UNAUTHORIZED') return 'Unauthorized';
  if (code === 'FORBIDDEN') return 'Forbidden';
  if (code === 'NOT_FOUND') return 'Not found';
  if (code === 'CONFLICT') return 'Conflict';
  if (code === 'BAD_REQUEST') return 'Bad request';
  return 'Internal server error';
}

if (require.main === module) {
  start();
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

export default app;
