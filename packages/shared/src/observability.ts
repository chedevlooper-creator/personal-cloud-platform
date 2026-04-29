import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Minimal Fastify-compatible app surface used by the observability plugin.
 * Kept structural so `@pcp/shared` does not need to depend on `fastify`.
 */
interface ObservabilityApp {
  addHook(
    name: 'onRequest' | 'onResponse',
    handler: (request: unknown, reply: unknown, done: () => void) => void,
  ): unknown;
  get(path: string, handler: (request: unknown, reply: unknown) => unknown | Promise<unknown>): unknown;
}

/**
 * Build a Fastify `genReqId` callback that adopts an incoming
 * `x-correlation-id` header when present, otherwise generates a fresh id.
 *
 * Length is bounded to mitigate header abuse, and the value is used as
 * `request.id` so pino logs and the response `x-correlation-id` header
 * propagate the same identifier across services.
 */
export function createCorrelationIdGenerator() {
  let counter = 0;
  return (req: { headers?: Record<string, string | string[] | undefined> }) => {
    const raw = req?.headers?.['x-correlation-id'];
    const incoming = Array.isArray(raw) ? raw[0] : raw;
    if (typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128) {
      // Strip control chars / whitespace.
      const safe = incoming.replace(/[^A-Za-z0-9._:-]/g, '');
      if (safe.length > 0) return safe;
    }
    counter = (counter + 1) >>> 0;
    return `req-${Date.now().toString(36)}-${counter.toString(36)}`;
  };
}

export interface ObservabilityOptions {
  serviceName: string;
  registry?: Registry;
  /** Disable default Node.js process metrics (mainly for tests). */
  disableDefaultMetrics?: boolean;
}

export interface ObservabilityHandles {
  registry: Registry;
  httpRequestsTotal: Counter<string>;
  httpRequestDurationSeconds: Histogram<string>;
  httpRequestsInFlight: Gauge<string>;
}

/**
 * Register `/metrics` Prometheus endpoint plus per-route HTTP counters and
 * a duration histogram. Safe to call once per Fastify instance.
 */
export function registerObservability(
  app: ObservabilityApp,
  opts: ObservabilityOptions,
): ObservabilityHandles {
  const registry = opts.registry ?? new Registry();
  registry.setDefaultLabels({ service: opts.serviceName });
  if (!opts.disableDefaultMetrics) {
    collectDefaultMetrics({ register: registry });
  }

  const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests handled by this service.',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
  });

  const httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds, labeled by method/route/status.',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const httpRequestsInFlight = new Gauge({
    name: 'http_requests_in_flight',
    help: 'Number of HTTP requests currently being processed.',
    labelNames: ['method'],
    registers: [registry],
  });

  /**
   * Resolve a low-cardinality route label. Only Fastify's matched route
   * template (`/users/:id`) is allowed; otherwise we collapse to a fixed
   * sentinel to keep metric cardinality bounded. Using `req.url` directly
   * would explode the time-series count under UUIDs / query strings.
   */
  const routeLabel = (req: { url?: string; routeOptions?: { url?: string } }): string => {
    const matched = req.routeOptions?.url;
    if (typeof matched === 'string' && matched.length > 0) return matched;
    return 'unmatched';
  };

  app.addHook('onRequest', (request: unknown, _reply: unknown, done: () => void) => {
    const req = request as { method?: string };
    httpRequestsInFlight.inc({ method: req.method ?? 'GET' });
    done();
  });

  app.addHook('onResponse', (request: unknown, reply: unknown, done: () => void) => {
    const req = request as {
      method?: string;
      url?: string;
      routeOptions?: { url?: string };
    };
    const rep = reply as { statusCode?: number; elapsedTime?: number };
    const method = req.method ?? 'GET';
    httpRequestsInFlight.dec({ method });
    const route = routeLabel(req);
    if (route === '/metrics') {
      done();
      return;
    }
    const status = String(rep.statusCode ?? 0);
    httpRequestsTotal.inc({ method, route, status });
    const elapsedMs = Number(rep.elapsedTime ?? 0);
    httpRequestDurationSeconds.observe({ method, route, status }, elapsedMs / 1000);
    done();
  });

  app.get('/metrics', async (_request: unknown, reply: unknown) => {
    const rep = reply as { header(name: string, value: string): unknown };
    rep.header('content-type', registry.contentType);
    return registry.metrics();
  });

  return { registry, httpRequestsTotal, httpRequestDurationSeconds, httpRequestsInFlight };
}

/**
 * Attach an `x-correlation-id` header to outbound fetch headers when a
 * correlation id is known. Safe to use with plain object header maps.
 */
export function withCorrelationHeaders(
  headers: Record<string, string> | undefined,
  correlationId: string | undefined,
): Record<string, string> {
  const out: Record<string, string> = { ...(headers ?? {}) };
  if (correlationId && !out['x-correlation-id']) {
    out['x-correlation-id'] = correlationId;
  }
  return out;
}
