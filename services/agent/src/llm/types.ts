export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string; // e.g. for tool responses
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema object
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface LLMResponse {
  content: string | null;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  type: 'text' | 'tool_call';
  content?: string;
  toolCall?: ToolCall;
}

export interface LLMProvider {
  readonly providerName: string;
  readonly modelName: string;
  generate(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;
  /**
   * Stream a chat completion. Emits text chunks as they arrive.
   * Tool calls are collected and emitted as a single chunk at the end
   * because streaming function-calling formats differ wildly between
   * providers and are complex to incremental-parse.
   */
  streamChat(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk>;
}
