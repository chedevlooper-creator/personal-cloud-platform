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

export interface LLMProvider {
  readonly providerName: string;
  readonly modelName: string;
  generate(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;
}
