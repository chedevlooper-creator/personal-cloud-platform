import { describe, it, expect } from 'vitest';
import { MemoryService } from './service';
import pino from 'pino';

describe('MemoryService', () => {
  const logger = pino({ level: 'silent' });
  
  it('should initialize successfully', () => {
    const service = new MemoryService(logger);
    expect(service).toBeDefined();
  });
});
