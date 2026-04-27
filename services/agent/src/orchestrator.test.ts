import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';

vi.mock('@pcp/db/src/client', () => ({
  db: {},
}));

describe('AgentOrchestrator', () => {
  const logger = pino({ level: 'silent' });
  
  it('should initialize successfully', async () => {
    const { AgentOrchestrator } = await import('./orchestrator');

    const orchestrator = new AgentOrchestrator(logger);
    expect(orchestrator).toBeDefined();
  });

  it('should initialize MiniMax Token Plan provider from environment', async () => {
    const { createLLMProvider } = await import('./llm/provider');
    const provider = createLLMProvider({
      LLM_PROVIDER: 'minimax',
      MINIMAX_TOKEN_PLAN_API_KEY: 'test-key',
    } as NodeJS.ProcessEnv);

    expect(provider).toBeDefined();
  });
});
