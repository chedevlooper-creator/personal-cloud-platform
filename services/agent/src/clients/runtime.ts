import { createInternalClient, createCircuitBreaker } from '@pcp/shared';
import { env } from '../env';

const client = createInternalClient({
  baseUrl: env.RUNTIME_SERVICE_URL,
  internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
});

const breaker = createCircuitBreaker({ name: 'runtime-client' });

export interface RuntimeRecord {
  id: string;
  workspaceId: string;
  image: string;
  status: string;
  createdAt: string | Date;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class RuntimeClient {
  async ensureForWorkspace(
    userId: string,
    workspaceId: string,
    image: string = env.RUNTIME_DEFAULT_IMAGE,
  ): Promise<RuntimeRecord> {
    return breaker.execute(() =>
      client.request<RuntimeRecord>({
        userId,
        method: 'POST',
        path: '/runtimes/ensure',
        body: { workspaceId, image },
      }),
    );
  }

  async exec(userId: string, runtimeId: string, command: string[]): Promise<ExecResult> {
    return breaker.execute(() =>
      client.request<ExecResult>({
        userId,
        method: 'POST',
        path: `/runtimes/${runtimeId}/exec`,
        body: { command },
      }),
    );
  }
}
