import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, Message, ToolDefinition, LLMResponse, ToolCall } from './types';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-3-opus-20240229') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const formattedMessages = messages.map(m => ({
      role: m.role === 'system' ? 'user' : m.role as any, // Claude puts system prompts elsewhere, but keeping simple here
      content: m.content,
    }));

    const systemMessage = messages.find(m => m.role === 'system')?.content;

    const filteredMessages = formattedMessages.filter(m => m.role !== 'system');

    const formattedTools = tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as any,
    }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemMessage,
      messages: filteredMessages,
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
