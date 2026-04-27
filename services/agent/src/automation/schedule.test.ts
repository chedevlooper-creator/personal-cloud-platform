import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_REPEAT_JOB_PREFIX,
  automationRepeatKey,
  computeNextRunAt,
  resolveSchedule,
} from './schedule';

describe('resolveSchedule', () => {
  it('maps hourly/daily/weekly to fixed cron patterns', () => {
    expect(resolveSchedule({ scheduleType: 'hourly' })).toMatchObject({
      isRepeating: true,
      pattern: '0 * * * *',
    });
    expect(resolveSchedule({ scheduleType: 'daily' })).toMatchObject({
      isRepeating: true,
      pattern: '0 9 * * *',
    });
    expect(resolveSchedule({ scheduleType: 'weekly' })).toMatchObject({
      isRepeating: true,
      pattern: '0 9 * * 1',
    });
  });

  it('passes user cron expressions through verbatim', () => {
    expect(
      resolveSchedule({ scheduleType: 'cron', cronExpression: '*/5 * * * *', timezone: 'UTC' }),
    ).toEqual({ isRepeating: true, pattern: '*/5 * * * *', timezone: 'UTC' });
  });

  it('returns non-repeating for manual or empty cron', () => {
    expect(resolveSchedule({ scheduleType: 'manual' })).toEqual({ isRepeating: false });
    expect(resolveSchedule({ scheduleType: 'cron', cronExpression: '   ' })).toEqual({
      isRepeating: false,
    });
  });
});

describe('computeNextRunAt', () => {
  it('returns null for manual / cron schedules', () => {
    expect(computeNextRunAt({ scheduleType: 'manual' })).toBeNull();
    expect(computeNextRunAt({ scheduleType: 'cron', cronExpression: '* * * * *' })).toBeNull();
  });

  it('hourly rolls forward to the next hour boundary', () => {
    const from = new Date('2026-04-26T12:34:56.000Z');
    const next = computeNextRunAt({ scheduleType: 'hourly' }, from)!;
    expect(next.getUTCMinutes()).toBe(0);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    expect(next.getTime() - from.getTime()).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('daily produces a future timestamp', () => {
    const from = new Date('2026-04-26T08:00:00.000Z');
    const next = computeNextRunAt({ scheduleType: 'daily' }, from)!;
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    expect(next.getTime() - from.getTime()).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
  });
});

describe('automationRepeatKey', () => {
  it('uses the documented prefix', () => {
    expect(automationRepeatKey('abc')).toBe(`${AUTOMATION_REPEAT_JOB_PREFIX}abc`);
  });
});
