import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, Message, ToolDefinition, LLMResponse, ToolCall } from './types';

type AnthropicAuthMode = 'api-key' | 'bearer';

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
    const formattedMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role as any,
      content: m.content,
    }));

    const systemMessage = messages.find(m => m.role === 'system')?.content;

    const formattedTools = tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as any,
    }));

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 4096,
      system: systemMessage,
      messages: formattedMessages,
      tools: formattedTools,
    } as any);

    let contentStr = null;
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      const b = block as any;
      if (b.type === 'text') {
        contentStr = b.text;
      } else if (b.type === 'tool_use') {
        toolCalls.push({
          id: b.id,
          name: b.name,
          arguments: JSON.stringify(b.input),
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
