/**
 * Schedule helpers for automations. Translates user-facing scheduleType values
 * (manual | hourly | daily | weekly | cron) into BullMQ repeat patterns and
 * computes the next-run timestamp for UI display.
 *
 * For "cron" we use the user-supplied expression as-is and intentionally do
 * NOT compute nextRunAt locally (avoids pulling in a cron parser dependency).
 * BullMQ owns the actual schedule.
 */

export interface AutomationScheduleInput {
  scheduleType: string;
  cronExpression?: string | null;
  timezone?: string | null;
}

export interface ResolvedSchedule {
  /** True when the automation should be enqueued as a repeating BullMQ job. */
  isRepeating: boolean;
  /** Cron-like pattern accepted by BullMQ `repeat.pattern`. */
  pattern?: string;
  /** Optional IANA timezone forwarded to BullMQ. */
  timezone?: string;
}

/**
 * Resolve the BullMQ repeat configuration for an automation.
 * Returns `{ isRepeating: false }` for manual or invalid configs.
 */
export function resolveSchedule(input: AutomationScheduleInput): ResolvedSchedule {
  const tz = input.timezone || undefined;
  switch (input.scheduleType) {
    case 'hourly':
      return { isRepeating: true, pattern: '0 * * * *', timezone: tz };
    case 'daily':
      return { isRepeating: true, pattern: '0 9 * * *', timezone: tz };
    case 'weekly':
      return { isRepeating: true, pattern: '0 9 * * 1', timezone: tz };
    case 'cron':
      if (input.cronExpression && input.cronExpression.trim().length > 0) {
        return { isRepeating: true, pattern: input.cronExpression.trim(), timezone: tz };
      }
      return { isRepeating: false };
    default:
      return { isRepeating: false };
  }
}

/**
 * Best-effort next-run estimate used purely for UI display. Accurate for
 * hourly/daily/weekly; returns null for cron expressions (BullMQ owns truth).
 */
export function computeNextRunAt(
  input: AutomationScheduleInput,
  from: Date = new Date(),
): Date | null {
  switch (input.scheduleType) {
    case 'hourly': {
      const next = new Date(from);
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next;
    }
    case 'daily': {
      const next = new Date(from);
      next.setHours(9, 0, 0, 0);
      if (next.getTime() <= from.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
    case 'weekly': {
      const next = new Date(from);
      next.setHours(9, 0, 0, 0);
      const dow = next.getDay(); // 0 Sun .. 6 Sat
      // Target Monday (1).
      const daysAhead = (1 - dow + 7) % 7 || (next.getTime() <= from.getTime() ? 7 : 0);
      next.setDate(next.getDate() + daysAhead);
      if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 7);
      return next;
    }
    default:
      return null;
  }
}

export const AUTOMATION_REPEAT_JOB_PREFIX = 'automation-';

export function automationRepeatKey(automationId: string): string {
  return `${AUTOMATION_REPEAT_JOB_PREFIX}${automationId}`;
}
