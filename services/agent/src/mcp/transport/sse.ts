import type { MCPTransport } from '../client';

/**
 * SSE transport for MCP servers.
 * Connects to an MCP server over HTTP Server-Sent Events using Node 20+ fetch.
 */
export class SSETransport implements MCPTransport {
  private abortController: AbortController | null = null;
  private endpointUrl: string;
  private handler: ((msg: unknown) => void) | null = null;

  constructor(url: string) {
    this.endpointUrl = url;
  }

  async start(): Promise<void> {
    this.abortController = new AbortController();
    const res = await fetch(this.endpointUrl, {
      headers: { Accept: 'text/event-stream' },
      signal: this.abortController.signal,
    });
    if (!res.body) throw new Error('SSE response has no body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const read = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (data) {
                try {
                  const msg = JSON.parse(data);
                  this.handler?.(msg);
                } catch {
                  // ignore non-JSON
                }
              }
            }
          }
        }
      } catch {
        // stream ended or aborted
      }
    };

    read();
  }

  async send(message: unknown): Promise<void> {
    const res = await fetch(this.endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      throw new Error(`SSE transport send failed: ${res.status}`);
    }
  }

  onMessage(handler: (msg: unknown) => void): void {
    this.handler = handler;
  }

  async close(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
  }
}
