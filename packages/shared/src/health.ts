/**
 * Minimal Fastify-compatible app surface used by the health plugin so
 * `@pcp/shared` does not need to depend on `fastify`.
 */
interface HealthApp {
  get(path: string, handler: (request: unknown, reply: unknown) => unknown | Promise<unknown>): unknown;
}

interface HealthReply {
  statusCode: number;
}

export interface HealthCheckResult {
  status: 'ok' | 'not_ready';
  checks: Record<string, boolean>;
}

/**
 * Build a health/readiness plugin factory.
 *
 * `/health` returns 200 immediately (liveness).
 * `/ready` returns 200 when all checks pass, 503 when any fail.
 */
export function createHealthRoute(
  dbCheckFn: () => Promise<boolean>,
  redisCheckFn?: () => Promise<boolean>,
) {
  return async function healthRoutes(app: HealthApp) {
    app.get('/health', async () => {
      return { status: 'ok' };
    });

    app.get('/ready', async (_request: unknown, reply: unknown) => {
      const rep = reply as HealthReply;
      const dbOk = await dbCheckFn().catch(() => false);
      const redisOk = redisCheckFn ? await redisCheckFn().catch(() => false) : true;

      const result: HealthCheckResult = {
        status: dbOk && redisOk ? 'ok' : 'not_ready',
        checks: { db: dbOk, redis: redisOk },
      };

      if (!dbOk || !redisOk) {
        rep.statusCode = 503;
      }

      return result;
    });
  };
}
