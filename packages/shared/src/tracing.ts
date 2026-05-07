import { trace, context, propagation } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

/**
 * Initialise OpenTelemetry tracing for a service. Safe to call once at
 * module startup.  The SDK is started lazily and registers the
 * W3C trace-context propagator so correlation ids flow across service
 * boundaries.
 */
export function initTracing(serviceName: string): void {
  if (sdk) return;

  const exporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
    textMapPropagator: new W3CTraceContextPropagator(),
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk?.shutdown().catch(() => undefined);
  });
}

/**
 * Extract the current trace id from the OpenTelemetry context, if any.
 * Falls back to `undefined` when tracing is not active.
 */
export function getCurrentTraceId(): string | undefined {
  const span = trace.getSpan(context.active());
  return span?.spanContext().traceId;
}

/**
 * Inject trace-parent headers into a plain object so outbound HTTP
 * requests carry the trace context.
 */
export function injectTraceHeaders(
  headers: Record<string, string> = {},
): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return { ...headers, ...carrier };
}
