import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';

vi.mock('@pcp/db/src/client', () => ({
  db: {},
}));

describe('MemoryService', () => {
  const logger = pino({ level: 'silent' });

  it('should initialize successfully', async () => {
    const { MemoryService } = await import('./service');
    const service = new MemoryService(logger);
    expect(service).toBeDefined();
  });
});
