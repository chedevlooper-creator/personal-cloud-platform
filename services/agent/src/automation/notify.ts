import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '@pcp/db/src/client';
import { notifications } from '@pcp/db/src/schema';
import { env } from '../env';

export interface AutomationRunSummary {
  runId: string;
  automationId: string;
  userId: string;
  title: string;
  status: 'completed' | 'failed';
  durationMs?: number;
  error?: string | null;
  output?: string | null;
}

export interface NotifyOptions {
  /** Notification mode set on the automation: 'none' | 'in-app' | 'email-mock' | 'webhook'. */
  mode: string;
  /** Optional webhook URL when mode === 'webhook'. */
  webhookUrl?: string | null;
  /** Optional logger. */
  logger?: { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void };
}

const WEBHOOK_TIMEOUT_MS = 10_000;

/**
 * Dispatch a notification for an automation run completion. Always inserts a
 * row into the `notifications` table (so the in-app badge counts every run),
 * and additionally fans out to the configured channel (webhook / email-mock).
 *
 * Failures in fan-out are logged but never thrown — the automation worker
 * should not crash because of a misconfigured destination.
 */
export async function dispatchAutomationRunNotification(
  run: AutomationRunSummary,
  opts: NotifyOptions,
): Promise<void> {
  const logger = opts.logger;
  const severity = run.status === 'completed' ? 'success' : 'error';

  const inAppTitle =
    run.status === 'completed'
      ? `Automation finished: ${run.title}`
      : `Automation failed: ${run.title}`;
  const inAppBody =
    run.status === 'completed'
      ? truncate(run.output ?? '', 500) || 'Run completed without output.'
      : truncate(run.error ?? 'Unknown error', 500);

  try {
    await db.insert(notifications).values({
      userId: run.userId,
      kind: 'automation_run',
      title: inAppTitle,
      body: inAppBody,
      severity,
      link: `/automations/${run.automationId}`,
      payload: {
        automationId: run.automationId,
        runId: run.runId,
        status: run.status,
      },
    });
  } catch (err) {
    logger?.warn({ err, runId: run.runId }, 'Failed to insert in-app notification');
  }

  if (opts.mode === 'webhook' && opts.webhookUrl) {
    await sendWebhook(opts.webhookUrl, run, logger);
  } else if (opts.mode === 'email-mock') {
    logger?.info(
      { runId: run.runId, userId: run.userId, status: run.status },
      'email-mock: would send automation run email',
    );
  }
}

async function sendWebhook(
  url: string,
  run: AutomationRunSummary,
  logger: NotifyOptions['logger'],
): Promise<void> {
  const body = JSON.stringify({
    type: 'automation_run',
    runId: run.runId,
    automationId: run.automationId,
    title: run.title,
    status: run.status,
    durationMs: run.durationMs,
    error: run.error ?? null,
    output: run.output ?? null,
    timestamp: new Date().toISOString(),
  });

  const signature = createHmac('sha256', env.INTERNAL_SERVICE_TOKEN).update(body).digest('hex');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pcp-Event': 'automation_run',
        'X-Pcp-Signature': `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger?.warn({ runId: run.runId, status: res.status, text: truncate(text, 200) }, 'Webhook returned non-2xx');
    }
  } catch (err) {
    logger?.warn({ err, runId: run.runId }, 'Webhook delivery failed');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compute the HMAC token used to validate inbound automation webhook triggers.
 * Token is shared per-automation and stable across server restarts (because
 * INTERNAL_SERVICE_TOKEN is stable).
 */
export function automationTriggerToken(automationId: string): string {
  return createHmac('sha256', env.INTERNAL_SERVICE_TOKEN)
    .update(`automation-trigger:${automationId}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Constant-time comparison of an inbound trigger token against the expected
 * value for the given automation.
 */
export function verifyAutomationTriggerToken(automationId: string, token: string): boolean {
  const expected = Buffer.from(automationTriggerToken(automationId));
  const actual = Buffer.from(token);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}
