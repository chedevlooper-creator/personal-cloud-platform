# BullMQ — services/agent/automation

## Repeatable / scheduled job

```ts
import { Queue } from 'bullmq';

const queue = new Queue('automations', { connection });

// Cron pattern
await queue.add('daily-summary', { userId }, { repeat: { pattern: '0 15 3 * * *' } });

// Interval with limit
await queue.add('poll', { runId }, { repeat: { every: 10_000, limit: 100 } });
```

## upsertJobScheduler (BullMQ 5+)

```ts
await queue.upsertJobScheduler(
  'limited-job',
  { every: 10_000, limit: 10 },
  { name: 'limited-execution-job', data: { message: 'x' } },
);
```

## Worker with rate limiter

```ts
import { Worker } from 'bullmq';

const worker = new Worker(
  'automations',
  async (job) => { await runAutomation(job.data); },
  {
    connection,
    concurrency: 10,
    limiter: { max: 100, duration: 60_000 }, // 100/min
  },
);
```

## Manual rate limit + UnrecoverableError

```ts
import { Worker, RateLimitError, UnrecoverableError } from 'bullmq';

new Worker('myQueue', async (job) => {
  const [limited, retryAfter] = await externalCall();
  if (limited) {
    await queue.rateLimit(retryAfter);
    if (job.attemptsStarted >= job.opts.attempts!) {
      throw new UnrecoverableError('Giving up');
    }
    throw new RateLimitError();
  }
}, { connection, limiter: { max: 1, duration: 500 } });
```

## Proje notları
- Redis bağlantısı ioredis üzerinden; tenant ayrımı için job `data` içinde `userId/organizationId` zorunlu.
- `removeOnComplete: { count: N }` ve `removeOnFail` ile Redis dolmasını engelle.
- Idempotency için `jobId`'yi domain key'inden türet.
- Failed job'ları kalıcı log/alarm için `failed` event'inde DB'ye yaz.
