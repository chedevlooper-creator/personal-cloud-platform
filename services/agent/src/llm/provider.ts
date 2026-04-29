import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { LLMProvider } from './types';

const DEFAULT_OPENAI_MODEL = 'gpt-4-turbo-preview';
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-opus-20240229';
const DEFAULT_MINIMAX_MODEL = 'MiniMax-M2.7';
const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimax.io/anthropic';

export type LLMProviderName = 'openai' | 'anthropic' | 'minimax';

export function createLLMProvider(env: NodeJS.ProcessEnv = process.env): LLMProvider {
  const provider = normalizeProviderName(env.LLM_PROVIDER);

  if (provider === 'minimax') {
    return new AnthropicProvider(
      env.MINIMAX_TOKEN_PLAN_API_KEY || env.MINIMAX_API_KEY || developmentProviderKey('minimax'),
      env.MINIMAX_MODEL || DEFAULT_MINIMAX_MODEL,
      env.MINIMAX_BASE_URL || DEFAULT_MINIMAX_BASE_URL,
      'bearer',
      'minimax',
    );
  }

  if (provider === 'anthropic') {
    return new AnthropicProvider(
      env.ANTHROPIC_API_KEY || developmentProviderKey('anthropic'),
      env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
      env.ANTHROPIC_BASE_URL,
    );
  }

  return new OpenAIProvider(
    env.OPENAI_API_KEY || developmentProviderKey('openai'),
    env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
  );
}

function normalizeProviderName(value: string | undefined): LLMProviderName {
  if (value === 'anthropic' || value === 'minimax' || value === 'openai') {
    return value;
  }

  return 'openai';
}

function developmentProviderKey(provider: LLMProviderName): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `Missing required LLM API key for provider "${provider}" in production. ` +
        `Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or MINIMAX_TOKEN_PLAN_API_KEY.`,
    );
  }
  return `dev-${provider}-api-key`;
}
