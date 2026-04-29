import OpenAI from 'openai';
import { LLMProvider, Message, ToolDefinition, LLMResponse } from './types';
import { withRetry } from './withRetry';

function toOpenAIRole(role: Message['role']): 'system' | 'user' | 'assistant' {
  return role;
}

export class OpenAIProvider implements LLMProvider {
  readonly providerName = 'openai';
  readonly modelName: string;
  private client: OpenAI;

  constructor(apiKey: string, model: string = 'gpt-4-turbo-preview') {
    this.client = new OpenAI({ apiKey });
    this.modelName = model;
  }

  async generate(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    return withRetry(() => this._generate(messages, tools), {
      label: 'OpenAIProvider',
      maxRetries: 3,
      baseDelayMs: 1000,
    });
  }

  private async _generate(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const formattedMessages = messages.map(m => ({
      role: toOpenAIRole(m.role),
      content: m.content,
      name: m.name,
    }));

    const formattedTools = tools?.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }
    }));

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: formattedMessages,
      tools: formattedTools,
      tool_choice: formattedTools ? 'auto' : 'none',
    });

    const choice = response.choices[0];
    if (!choice) throw new Error('No choice returned from OpenAI');
    const message = choice.message;

    const toolCalls = message.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    return {
      content: message.content,
      toolCalls,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }
}
