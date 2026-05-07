import OpenAI from 'openai';
import { LLMProvider, Message, ToolDefinition, LLMResponse, StreamChunk } from './types';
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

  async *streamChat(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk> {
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

    const stream = await this.client.chat.completions.create({
      model: this.modelName,
      messages: formattedMessages,
      tools: formattedTools,
      tool_choice: formattedTools ? 'auto' : 'none',
      stream: true,
    });

    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield { type: 'text', content: delta.content };
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          let buf = toolCallBuffers.get(idx);
          if (!buf) {
            buf = { id: tc.id ?? '', name: tc.function?.name ?? '', args: tc.function?.arguments ?? '' };
            toolCallBuffers.set(idx, buf);
          } else {
            if (tc.id) buf.id = tc.id;
            if (tc.function?.name) buf.name = tc.function.name;
            if (tc.function?.arguments) buf.args += tc.function.arguments;
          }
        }
      }
    }

    for (const buf of toolCallBuffers.values()) {
      yield { type: 'tool_call', toolCall: { id: buf.id, name: buf.name, arguments: buf.args } };
    }
  }
}
