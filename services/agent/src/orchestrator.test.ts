import { describe, it, expect } from 'vitest';
import { AgentOrchestrator } from './orchestrator';
import pino from 'pino';

describe('AgentOrchestrator', () => {
  const logger = pino({ level: 'silent' });
  
  it('should initialize successfully', () => {
    const orchestrator = new AgentOrchestrator(logger);
    expect(orchestrator).toBeDefined();
  });
});
