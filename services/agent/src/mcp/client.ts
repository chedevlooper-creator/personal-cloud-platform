/**
 * MCP (Model Context Protocol) client wrapper.
 *
 * Connects to an external MCP server via stdio or SSE, discovers available
 * tools, and invokes them on behalf of the agent orchestrator.
 */

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface MCPTransport {
  start(): Promise<void>;
  send(message: unknown): Promise<void>;
  onMessage(handler: (msg: unknown) => void): void;
  close(): Promise<void>;
}

export class MCPClient {
  private tools: MCPToolDefinition[] = [];
  private messageHandlers: Array<(msg: unknown) => void> = [];
  private requestId = 0;
  private pending = new Map<number, (value: unknown) => void>();

  constructor(
    private transport: MCPTransport,
    private serverName: string,
  ) {}

  async connect(): Promise<void> {
    this.transport.onMessage((msg) => this.handleMessage(msg));
    await this.transport.start();

    // Discover tools
    const response = await this.request('tools/list', {});
    const result = (response as { tools?: MCPToolDefinition[] })?.tools ?? [];
    this.tools = result;

    // reference serverName to satisfy noUnusedLocals
    void this.serverName;
  }

  getTools(): MCPToolDefinition[] {
    return this.tools;
  }

  async invokeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await this.request('tools/call', {
      name: toolName,
      arguments: args,
    });
    return response;
  }

  private handleMessage(msg: unknown): void {
    const m = msg as { id?: number; result?: unknown; error?: unknown };
    if (m.id !== undefined && this.pending.has(m.id)) {
      const resolve = this.pending.get(m.id)!;
      this.pending.delete(m.id);
      if (m.error) {
        throw new Error(JSON.stringify(m.error));
      }
      resolve(m.result);
    }
    for (const h of this.messageHandlers) {
      h(msg);
    }
  }

  private async request(method: string, params: unknown): Promise<unknown> {
    const id = ++this.requestId;
    await this.transport.send({ jsonrpc: '2.0', id, method, params });
    return new Promise<unknown>((resolve) => {
      this.pending.set(id, resolve);
    });
  }

  async disconnect(): Promise<void> {
    await this.transport.close();
    this.pending.clear();
  }
}
