import { spawn, ChildProcess } from 'child_process';
import type { MCPTransport } from '../client';

/**
 * stdio transport for MCP servers.
 * Spawns a child process and communicates over stdin/stdout.
 */
export class StdioMCPTransport implements MCPTransport {
  private proc: ChildProcess | null = null;
  private handler: ((msg: unknown) => void) | null = null;
  private buffer = '';

  constructor(
    private command: string,
    private args: string[] = [],
    private envVars: Record<string, string> = {},
  ) {}

  async start(): Promise<void> {
    this.proc = spawn(this.command, this.args, {
      env: { ...process.env, ...this.envVars },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString('utf8');
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          this.handler?.(msg);
        } catch {
          // ignore non-JSON lines
        }
      }
    });

    this.proc.stderr?.on('data', (data: Buffer) => {
      console.error('MCP server stderr:', data.toString('utf8'));
    });

    return new Promise((resolve, reject) => {
      this.proc!.on('error', reject);
      this.proc!.on('spawn', resolve);
    });
  }

  async send(message: unknown): Promise<void> {
    if (!this.proc?.stdin) throw new Error('Transport not started');
    this.proc.stdin.write(JSON.stringify(message) + '\n');
  }

  onMessage(handler: (msg: unknown) => void): void {
    this.handler = handler;
  }

  async close(): Promise<void> {
    this.proc?.kill();
    this.proc = null;
  }
}
