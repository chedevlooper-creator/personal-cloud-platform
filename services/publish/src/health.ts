import { db } from '@pcp/db/src/client';
import { hostedServices, hostedServiceLogs, notifications } from '@pcp/db/src/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { PublishService } from './service';

const HEALTH_TIMEOUT_MS = 5_000;
const CONSECUTIVE_FAIL_THRESHOLD = 3;
// Backoff schedule (seconds): 10s, 30s, 2m, 10m, then capped.
const BACKOFF_SECONDS = [10, 30, 120, 600, 600];
const MAX_RESTART_ATTEMPTS_PER_HOUR = 5;

type ServiceHealthState = {
  consecutiveFailures: number;
  // recent restart attempts (epoch-ms)
  restartHistory: number[];
  // earliest moment we may try restart again
  nextRestartAfter: number;
  inFlight: boolean;
};

const state = new Map<string, ServiceHealthState>();

function getState(serviceId: string): ServiceHealthState {
  let s = state.get(serviceId);
  if (!s) {
    s = {
      consecutiveFailures: 0,
      restartHistory: [],
      nextRestartAfter: 0,
      inFlight: false,
    };
    state.set(serviceId, s);
  }
  return s;
}

async function pingUrl(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET', signal, redirect: 'follow' });
    // Treat any 2xx/3xx/401/403 as "process is alive". Only network failures and
    // 5xx count as unhealthy.
    if (res.status >= 500) return false;
    return true;
  } catch {
    return false;
  }
}

export interface HealthDaemonOptions {
  intervalMs?: number;
  publishService: PublishService;
  logger: FastifyBaseLogger;
}

export function startHealthDaemon(opts: HealthDaemonOptions) {
  const intervalMs = opts.intervalMs ?? 30_000;
  const log = opts.logger.child({ component: 'health-daemon' });

  log.info({ intervalMs }, 'health daemon starting');

  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      await runHealthCheck(opts.publishService, log);
    } catch (err) {
      log.error({ err }, 'health daemon tick failed');
    }
  };

  const handle = setInterval(tick, intervalMs);
  // Run immediately so first cycle doesn't wait the full interval.
  void tick();

  return {
    stop: () => {
      stopped = true;
      clearInterval(handle);
    },
  };
}

async function runHealthCheck(publishService: PublishService, log: FastifyBaseLogger) {
  const services = await db.query.hostedServices.findMany({
    where: and(eq(hostedServices.status, 'running'), isNull(hostedServices.deletedAt)),
  });

  await Promise.all(
    services.map((svc) => checkOne(svc, publishService, log).catch((err) => {
      log.error({ err, serviceId: svc.id }, 'health check failed');
    })),
  );

  // Also progress crashed services that are eligible for auto-restart.
  const crashed = await db.query.hostedServices.findMany({
    where: and(
      eq(hostedServices.status, 'crashed'),
      eq(hostedServices.autoRestart, true),
      isNull(hostedServices.deletedAt),
    ),
  });
  await Promise.all(
    crashed.map((svc) => attemptRestart(svc, publishService, log).catch((err) => {
      log.error({ err, serviceId: svc.id }, 'restart attempt failed');
    })),
  );
}

async function checkOne(
  svc: typeof hostedServices.$inferSelect,
  publishService: PublishService,
  log: FastifyBaseLogger,
) {
  if (!svc.publicUrl) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  let ok = false;
  try {
    ok = await pingUrl(svc.publicUrl, controller.signal);
  } finally {
    clearTimeout(timer);
  }

  await db
    .update(hostedServices)
    .set({ lastHealthAt: new Date(), lastHealthOk: ok })
    .where(eq(hostedServices.id, svc.id));

  const s = getState(svc.id);
  if (ok) {
    s.consecutiveFailures = 0;
    return;
  }

  s.consecutiveFailures += 1;
  log.warn(
    { serviceId: svc.id, consecutiveFailures: s.consecutiveFailures },
    'service health check failed',
  );

  if (s.consecutiveFailures >= CONSECUTIVE_FAIL_THRESHOLD) {
    await markCrashed(svc, 'health check failed 3 times in a row');
    s.consecutiveFailures = 0;
    if (svc.autoRestart) {
      await attemptRestart({ ...svc, status: 'crashed' }, publishService, log);
    }
  }
}

async function markCrashed(svc: typeof hostedServices.$inferSelect, reason: string) {
  await db
    .update(hostedServices)
    .set({ status: 'crashed', crashCount: svc.crashCount + 1, lastHealthOk: false })
    .where(eq(hostedServices.id, svc.id));

  await db.insert(hostedServiceLogs).values({
    serviceId: svc.id,
    stream: 'system',
    line: `Service marked crashed: ${reason}`,
  });

  await db.insert(notifications).values({
    userId: svc.userId,
    kind: 'hosted_service_crashed',
    title: `Service ${svc.name} crashed`,
    body: reason,
    severity: 'error',
    link: `/hosting`,
    payload: { serviceId: svc.id },
  });
}

async function attemptRestart(
  svc: typeof hostedServices.$inferSelect,
  publishService: PublishService,
  log: FastifyBaseLogger,
) {
  const s = getState(svc.id);
  const now = Date.now();

  if (s.inFlight) return;
  if (now < s.nextRestartAfter) return;

  // Prune restart history older than 1h.
  s.restartHistory = s.restartHistory.filter((t) => now - t < 60 * 60 * 1000);
  if (s.restartHistory.length >= MAX_RESTART_ATTEMPTS_PER_HOUR) {
    log.warn(
      { serviceId: svc.id, attempts: s.restartHistory.length },
      'auto-restart cap reached for the hour; skipping',
    );
    // Push the next attempt out 10m so we don't spam this branch.
    s.nextRestartAfter = now + 10 * 60 * 1000;
    return;
  }

  s.inFlight = true;
  s.restartHistory.push(now);
  const attemptIndex = Math.min(s.restartHistory.length - 1, BACKOFF_SECONDS.length - 1);
  const backoffSec = BACKOFF_SECONDS[attemptIndex] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]!;
  s.nextRestartAfter = now + backoffSec * 1000;

  try {
    log.info(
      { serviceId: svc.id, attempt: s.restartHistory.length, backoffSec },
      'auto-restarting crashed service',
    );
    await publishService.startService(svc.id, svc.userId);
    await db.insert(hostedServiceLogs).values({
      serviceId: svc.id,
      stream: 'system',
      line: `Auto-restart attempt #${s.restartHistory.length} dispatched (next backoff ${backoffSec}s)`,
    });
  } catch (err) {
    log.error({ err, serviceId: svc.id }, 'auto-restart failed');
    await db.insert(hostedServiceLogs).values({
      serviceId: svc.id,
      stream: 'stderr',
      line: `Auto-restart failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    s.inFlight = false;
  }
}

// Exposed for tests.
export const __test__ = { state, BACKOFF_SECONDS, CONSECUTIVE_FAIL_THRESHOLD };
