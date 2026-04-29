import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, Message, ToolDefinition, LLMResponse, ToolCall } from './types';
import { withRetry } from './withRetry';

type AnthropicAuthMode = 'api-key' | 'bearer';

function toAnthropicRole(role: Message['role']): 'user' | 'assistant' {
  return role === 'assistant' ? 'assistant' : 'user';
}

function toAnthropicInputSchema(parameters: ToolDefinition['parameters']) {
  return {
    type: 'object' as const,
    ...parameters,
  };
}

export class AnthropicProvider implements LLMProvider {
  readonly providerName: string;
  readonly modelName: string;
  private client: Anthropic;

  constructor(
    apiKey: string,
    model: string = 'claude-3-opus-20240229',
    baseURL?: string,
    authMode: AnthropicAuthMode = 'api-key',
    providerNameParam = 'anthropic',
  ) {
    this.client = new Anthropic({
      apiKey: authMode === 'api-key' ? apiKey : null,
      authToken: authMode === 'bearer' ? apiKey : null,
      baseURL,
    });
    this.modelName = model;
    this.providerName = providerNameParam;
  }

  async generate(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    return withRetry(() => this._generate(messages, tools), {
      label: 'AnthropicProvider',
      maxRetries: 3,
      baseDelayMs: 1000,
    });
  }

  private async _generate(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const formattedMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: toAnthropicRole(m.role),
      content: m.content,
    }));

    const systemMessage = messages.find(m => m.role === 'system')?.content;

    const formattedTools = tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: toAnthropicInputSchema(t.parameters),
    }));

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 4096,
      system: systemMessage,
      messages: formattedMessages,
      tools: formattedTools,
    });

    let contentStr = null;
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        contentStr = block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input),
        });
      }
    }

    return {
      content: contentStr,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}
